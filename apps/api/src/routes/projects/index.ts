import { deployments, projects } from "@lite/db/schema";
import { and, count, desc, eq, ilike, or } from "drizzle-orm";
import { Hono } from "hono";
import { nanoid } from "nanoid";
import { generateSlug } from "random-word-slugs";
import z from "zod";
import type { ReqVariables } from "../../utils/hono.js";
import {
  enrichDeploymentMetadata,
  getDeploymentLogs,
  parseLogEvents,
  redis,
  resolveDeploymentId,
  startBuildTask,
  syncDeploymentFromMetadata,
} from "../../services/deployment-pipeline.js";

const projectsRouter = new Hono<{ Variables: ReqVariables }>();

const listProjectsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
  q: z.string().trim().optional(),
});

projectsRouter.get("/", async (c) => {
  const db = c.get("db");
  const session = c.get("session");
  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const parsed = listProjectsQuerySchema.safeParse({
    page: c.req.query("page"),
    limit: c.req.query("limit"),
    q: c.req.query("q"),
  });

  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const { page, limit, q } = parsed.data;
  const filters = [eq(projects.userId, session.user.id)];

  if (q) {
    const pattern = `%${q}%`;
    filters.push(
      or(
        ilike(projects.name, pattern),
        ilike(projects.slug, pattern),
        ilike(projects.repoUrl, pattern),
        ilike(projects.subDomain, pattern),
        ilike(projects.customDomain, pattern),
      )!,
    );
  }

  const where = and(...filters);
  const offset = (page - 1) * limit;

  const [items, totalRow] = await Promise.all([
    db
      .select()
      .from(projects)
      .where(where)
      .orderBy(desc(projects.updatedAt))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(projects).where(where),
  ]);

  const total = totalRow[0]?.total ?? 0;

  return c.json({
    projects: items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  });
});

const projectBodySchema = z.object({
  repoUrl: z.string(),
  slug: z.string().optional(),
  envVars: z
    .array(
      z.object({
        key: z.string(),
        value: z.string(),
      }),
    )
    .optional(),
});

projectsRouter.post("/", async (c) => {
  const db = c.get("db");
  const reqBody = await c.req.json();
  const validated = projectBodySchema.safeParse(reqBody);
  const session = c.get("session");
  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  if (!validated.success) {
    return c.json({ error: validated.error.issues }, 400);
  }

  const { repoUrl, slug, envVars } = validated.data;

  const envVarsRecord =
    envVars?.reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {}) ||
    {};

  const cleanupEnvVars = Object.fromEntries(
    Object.entries(envVarsRecord).filter(
      ([key, value]) => key !== "" && value !== "",
    ),
  );

  const finalSlug = slug ?? generateSlug();
  const name = repoUrl.split("/").pop() ?? finalSlug;
  const id = nanoid(8);
  const deploymentId = nanoid(12);
  const deploymentUrl = `${finalSlug}.localhoststories.dev`;

  const [project] = await db
    .insert(projects)
    .values({
      id,
      userId: session.user.id,
      repoUrl,
      slug: finalSlug,
      buildCommand: "npm run build",
      name,
      subDomain: finalSlug,
      customDomain: "",
      envVars: cleanupEnvVars,
    })
    .returning();

  await db.insert(deployments).values({
    id: deploymentId,
    projectId: project.id,
    url: deploymentUrl,
    status: "queued",
  });

  try {
    await startBuildTask({
      projectSlug: finalSlug,
      deploymentId,
      repoUrl,
      envVars: cleanupEnvVars as Record<string, string>,
    });

    await db
      .update(deployments)
      .set({
        status: "building",
        updatedAt: new Date(),
      })
      .where(eq(deployments.id, deploymentId));
  } catch (error) {
    await db
      .update(deployments)
      .set({
        status: "failed",
        errorMessage: error instanceof Error ? error.message : String(error),
        finishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(deployments.id, deploymentId));

    console.error("Error running ECS task:", error);
    return c.json({ error: "Failed to start build" }, 500);
  }

  return c.json({ ...project, deploymentId });
});

projectsRouter.post("/:slug/deploy", async (c) => {
  const db = c.get("db");
  const session = c.get("session");
  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const slug = c.req.param("slug");

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.slug, slug), eq(projects.userId, session.user.id)),
  });

  if (!project) {
    return c.json({ error: "Project not found" }, 404);
  }

  const deploymentId = nanoid(12);
  const deploymentUrl = `${project.slug}.localhoststories.dev`;
  const envVars = (project.envVars as Record<string, string> | null) ?? {};

  await db.insert(deployments).values({
    id: deploymentId,
    projectId: project.id,
    url: deploymentUrl,
    status: "queued",
    redeployOfId: project.currentDeploymentId,
    commitMessage: project.lastCommitMessage,
    commitHash: project.lastCommitHash,
    commitAuthor: project.lastCommitAuthor,
    branch: project.lastDeploymentBranch,
  });

  try {
    await startBuildTask({
      projectSlug: project.slug,
      deploymentId,
      repoUrl: project.repoUrl,
      envVars,
    });

    await db
      .update(deployments)
      .set({
        status: "building",
        updatedAt: new Date(),
      })
      .where(eq(deployments.id, deploymentId));
  } catch (error) {
    await db
      .update(deployments)
      .set({
        status: "failed",
        errorMessage: error instanceof Error ? error.message : String(error),
        finishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(deployments.id, deploymentId));

    console.error("Error running ECS task:", error);
    return c.json({ error: "Failed to start build" }, 500);
  }

  return c.json({ deploymentId, projectSlug: project.slug });
});

projectsRouter.get("/:slug/deployments", async (c) => {
  const db = c.get("db");
  const slug = c.req.param("slug");

  const project = await db.query.projects.findFirst({
    where: eq(projects.slug, slug),
  });

  if (!project) {
    return c.json({ error: "Project not found" }, 404);
  }

  const rows = await db
    .select({
      id: deployments.id,
      status: deployments.status,
      type: deployments.type,
      url: deployments.url,
      commitMessage: deployments.commitMessage,
      commitHash: deployments.commitHash,
      commitAuthor: deployments.commitAuthor,
      branch: deployments.branch,
      redeployOfId: deployments.redeployOfId,
      createdAt: deployments.createdAt,
      updatedAt: deployments.updatedAt,
      finishedAt: deployments.finishedAt,
      errorMessage: deployments.errorMessage,
    })
    .from(deployments)
    .where(eq(deployments.projectId, project.id))
    .orderBy(desc(deployments.createdAt));

  return c.json({
    project: {
      id: project.id,
      slug: project.slug,
      name: project.name,
      subDomain: project.subDomain,
      currentDeploymentId: project.currentDeploymentId,
    },
    deployments: rows.map((row) => ({
      ...row,
      isCurrent: row.id === project.currentDeploymentId,
    })),
  });
});

projectsRouter.get("/:deploymentId/logs", async (c) => {
  const db = c.get("db");

  const deploymentId = await resolveDeploymentId(
    db,
    c.req.param("deploymentId"),
  );

  if (!deploymentId) {
    return c.json({ error: "Deployment not found" }, 404);
  }

  const deploymentKey = `deployment:${deploymentId}`;
  const metadata = await redis.hgetall(deploymentKey);

  await syncDeploymentFromMetadata(db, deploymentId, metadata);

  const [logs, deployment] = await Promise.all([
    getDeploymentLogs(db, deploymentId),
    enrichDeploymentMetadata(db, deploymentId, metadata),
  ]);

  return c.json({
    logs,
    deployment,
  });
});

projectsRouter.get("/:deploymentId/logs/stream", async (c) => {
  const db = c.get("db");

  const deploymentId = await resolveDeploymentId(
    db,
    c.req.param("deploymentId"),
  );

  if (!deploymentId) {
    return c.json({ error: "Deployment not found" }, 404);
  }

  const logsKey = `logs:${deploymentId}`;
  const deploymentKey = `deployment:${deploymentId}`;
  const encoder = new TextEncoder();
  const sentLogIds = new Set<string>();
  let closed = false;
  let controllerClosed = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const markClosed = () => {
    closed = true;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  c.req.raw.signal.addEventListener("abort", () => {
    markClosed();
  });

  const stream = new ReadableStream({
    start(controller) {
      const safelyCloseController = () => {
        if (controllerClosed) return;
        controllerClosed = true;
        controller.close();
      };

      const send = (event: string, data: unknown) => {
        if (controllerClosed || closed) return;
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      const tick = async () => {
        if (closed) {
          safelyCloseController();
          return;
        }

        try {
          const [rawLogs, deploymentMeta] = await Promise.all([
            redis.lrange(logsKey, 0, -1),
            redis.hgetall(deploymentKey),
          ]);

          await syncDeploymentFromMetadata(db, deploymentId, deploymentMeta);

          const enrichedDeployment = await enrichDeploymentMetadata(
            db,
            deploymentId,
            deploymentMeta,
          );

          const parsedLogs = parseLogEvents(rawLogs);
          for (const logEvent of parsedLogs) {
            if (sentLogIds.has(logEvent.id)) continue;
            sentLogIds.add(logEvent.id);
            send("log", logEvent);
          }

          send("deployment", enrichedDeployment);

          const terminalStatuses = ["error", "failed", "healthy"];
          if (terminalStatuses.includes(enrichedDeployment?.status ?? "")) {
            send("done", { status: enrichedDeployment.status });
            markClosed();
            safelyCloseController();
            return;
          }
        } catch (error) {
          send("error", {
            message: "Failed to stream logs",
            error: error instanceof Error ? error.message : String(error),
          });
        } finally {
          if (!closed) {
            timer = setTimeout(tick, 1000);
          }
        }
      };

      send("connected", { deploymentId });
      void tick();
    },
    cancel() {
      markClosed();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
});

export default projectsRouter;
