import { ECSClient, RunTaskCommand } from "@aws-sdk/client-ecs";
import { deploymentStatusEnum, deployments, projects } from "@lite/db/schema";
import { env } from "@lite/env/server.js";
import { desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import Redis from "ioredis";
import { nanoid } from "nanoid";
import { generateSlug } from "random-word-slugs";
import z from "zod";
import type { ReqVariables } from "../../utils/hono.js";

const projectsRouter = new Hono<{ Variables: ReqVariables }>();

projectsRouter.get("/", async (c) => {
  const db = c.get("db");
  const allProjects = await db.select().from(projects);
  return c.json(allProjects);
});

const projectBodySchema = z.object({
  repoUrl: z.string(),
  slug: z.string().optional(),
});

const ecsClient = new ECSClient({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
});

const CONFIG = {
  CLUSTER: env.ECS_CLUSTER_ARN,
  TASK: env.ECS_TASK_DEFINITION_ARN,
};

const redis = new Redis(env.REDIS_URL);

type LogEvent = {
  id: string;
  timestamp: number;
  level: "info" | "error" | "success" | "warn";
  message: string;
  source?: "build" | "system";
};

type DeploymentDbStatus = (typeof deploymentStatusEnum.enumValues)[number];
type DbClient = ReqVariables["db"];
type DeploymentMetadata = Record<string, string>;
const HEALTHCHECK_ATTEMPTS = 5;
const HEALTHCHECK_DELAY_MS = 1500;

function parseLogEvents(rawLogs: string[]): LogEvent[] {
  return rawLogs.flatMap((rawLog) => {
    try {
      return [JSON.parse(rawLog) as LogEvent];
    } catch {
      return [];
    }
  });
}

function toDeploymentDbStatus(
  metadataStatus?: string,
): DeploymentDbStatus | null {
  switch (metadataStatus) {
    case "running":
      return "building";
    case "deploying":
      return "deploying";
    case "healthy":
      return "healthy";
    case "success":
      return "built";
    case "error":
    case "failed":
      return "failed";
    default:
      return null;
  }
}

async function syncDeploymentFromMetadata(
  db: DbClient,
  deploymentId: string,
  metadata: DeploymentMetadata,
) {
  const dbStatus = toDeploymentDbStatus(metadata.status);
  if (!dbStatus) return;

  const isTerminal =
    dbStatus === "built" || dbStatus === "healthy" || dbStatus === "failed";

  await db
    .update(deployments)
    .set({
      status: dbStatus,
      finishedAt: isTerminal ? new Date() : undefined,
      errorMessage:
        dbStatus === "failed"
          ? metadata.errorMessage || metadata.message || "Build failed"
          : undefined,
      updatedAt: new Date(),
    })
    .where(eq(deployments.id, deploymentId));

  if (dbStatus === "built" || dbStatus === "healthy") {
    const [deploymentRecord] = await db
      .select({
        projectId: deployments.projectId,
      })
      .from(deployments)
      .where(eq(deployments.id, deploymentId))
      .limit(1);

    if (deploymentRecord) {
      await db
        .update(projects)
        .set({
          currentDeploymentId: deploymentId,
          updatedAt: new Date(),
        })
        .where(eq(projects.id, deploymentRecord.projectId));
    }
  }

  if (dbStatus === "built") {
    await db
      .update(deployments)
      .set({
        type: metadata.deploymentType === "container" ? "container" : "static",
        imageUrl: metadata.imageUrl,
        url: metadata.artifactUrl || deployments.url,
      })
      .where(eq(deployments.id, deploymentId));

    void rolloutRuntimeDeployment(db, deploymentId);
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function isDeploymentHealthy(url: string) {
  for (let i = 0; i < HEALTHCHECK_ATTEMPTS; i += 1) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const response = await fetch(`https://${url}`, {
        method: "GET",
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (response.ok || response.status === 301 || response.status === 302) {
        return true;
      }
    } catch {
      /* probe retries below */
    }

    await sleep(HEALTHCHECK_DELAY_MS);
  }

  return false;
}

async function rolloutRuntimeDeployment(db: DbClient, deploymentId: string) {
  const [deployment] = await db
    .select()
    .from(deployments)
    .where(eq(deployments.id, deploymentId))
    .limit(1);

  if (!deployment || deployment.status !== "built") {
    return;
  }

  if (deployment.type === "static") {
    await db
      .update(deployments)
      .set({
        status: "healthy",
        finishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(deployments.id, deploymentId));

    await db
      .update(projects)
      .set({
        currentDeploymentId: deploymentId,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, deployment.projectId));
    return;
  }

  await db
    .update(deployments)
    .set({
      status: "deploying",
      updatedAt: new Date(),
    })
    .where(eq(deployments.id, deploymentId));

  try {
    const command = new RunTaskCommand({
      cluster: CONFIG.CLUSTER,
      taskDefinition: env.ECS_TASK_DEFINITION_ARN,
      launchType: "FARGATE",
      count: 1,
      networkConfiguration: {
        awsvpcConfiguration: {
          assignPublicIp: "ENABLED",
          subnets: [env.SUBNET_1, env.SUBNET_2, env.SUBNET_3],
          securityGroups: [env.SECURITY_GROUP],
        },
      },
      overrides: {
        containerOverrides: [
          {
            name: "builder-image",
            command: ["npm", "start"],
            environment: [
              { name: "ARTIFACT_URL", value: deployment.url },
              { name: "AWS_ACCESS_KEY_ID", value: env.AWS_ACCESS_KEY_ID },
              {
                name: "AWS_SECRET_ACCESS_KEY",
                value: env.AWS_SECRET_ACCESS_KEY,
              },
              { name: "AWS_REGION", value: env.AWS_REGION },
              { name: "PORT", value: String(deployment.runtimePort || 3000) },
              ...Object.entries(
                (deployment.envVars as Record<string, string>) || {},
              ).map(([name, value]) => ({
                name,
                value: String(value),
              })),
            ],
          },
        ],
      },
    });

    const result = await ecsClient.send(command);
    const taskArn = result.tasks?.[0]?.taskArn;

    if (!taskArn) {
      throw new Error("Failed to start ECS task for runner");
    }

    const healthy = await isDeploymentHealthy(deployment.url);

    if (!healthy) {
      throw new Error("Runtime health check failed after rollout");
    }

    await db
      .update(deployments)
      .set({
        status: "healthy",
        finishedAt: new Date(),
        updatedAt: new Date(),
        // taskDefinitionArn: taskArn, // Store the running task ARN
      })
      .where(eq(deployments.id, deploymentId));

    await db
      .update(projects)
      .set({
        currentDeploymentId: deploymentId,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, deployment.projectId));
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
  }
}

projectsRouter.post("/", async (c) => {
  const db = c.get("db");
  const reqBody = await c.req.json();
  const validated = projectBodySchema.safeParse(reqBody);

  if (!validated.success) {
    return c.json({ error: validated.error.issues }, 400);
  }

  const { repoUrl, slug } = validated.data;

  const finalSlug = slug ?? generateSlug();
  const name = repoUrl.split("/").pop() ?? finalSlug;
  const id = nanoid(8);
  const deploymentId = nanoid(12);
  const deploymentUrl = `${finalSlug}.localhoststories.dev`;

  const [project] = await db
    .insert(projects)
    .values({
      id,
      repoUrl,
      slug: finalSlug,
      buildCommand: "npm run build",
      name,
      subDomain: finalSlug,
      customDomain: "",
    })
    .returning();

  await db.insert(deployments).values({
    id: deploymentId,
    projectId: project.id,
    url: deploymentUrl,
    status: "queued",
  });

  const command = new RunTaskCommand({
    cluster: CONFIG.CLUSTER,
    taskDefinition: CONFIG.TASK,
    launchType: "FARGATE",
    count: 1,
    networkConfiguration: {
      awsvpcConfiguration: {
        assignPublicIp: "ENABLED",
        subnets: [env.SUBNET_1, env.SUBNET_2, env.SUBNET_3],
        securityGroups: [env.SECURITY_GROUP],
      },
    },
    overrides: {
      containerOverrides: [
        {
          name: "builder-image",
          environment: [
            { name: "GIT_REPOSITORY_URL", value: repoUrl },
            { name: "PROJECT_ID", value: finalSlug },
            { name: "DEPLOYMENT_ID", value: deploymentId },
            { name: "AWS_ACCESS_KEY_ID", value: env.AWS_ACCESS_KEY_ID },
            { name: "AWS_SECRET_ACCESS_KEY", value: env.AWS_SECRET_ACCESS_KEY },
            { name: "AWS_REGION", value: env.AWS_REGION },
            { name: "REDIS_URL", value: env.REDIS_URL },
          ],
        },
      ],
    },
  });

  try {
    await ecsClient.send(command);

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

projectsRouter.get("/:deploymentId/logs", async (c) => {
  const db = c.get("db");

  if (!redis) {
    return c.json({ error: "Redis is not configured" }, 500);
  }

  const idParam = c.req.param("deploymentId");
  let deploymentId = idParam;

  const projectWithLatest = await db.query.projects.findFirst({
    where: eq(projects.slug, idParam),
  });

  if (projectWithLatest) {
    const [latest] = await db
      .select()
      .from(deployments)
      .where(eq(deployments.projectId, projectWithLatest.id))
      .orderBy(desc(deployments.createdAt))
      .limit(1);

    if (latest) {
      deploymentId = latest.id;
    }
  }

  const logsKey = `logs:${deploymentId}`;
  const deploymentKey = `deployment:${deploymentId}`;

  console.log(
    `[API DEBUG] Fetching logs for key: ${logsKey} (URL: ${env.REDIS_URL.split("@")[1] || "hidden"})`,
  );

  const [logs, metadata] = await Promise.all([
    redis.lrange(logsKey, 0, -1),
    redis.hgetall(deploymentKey),
  ]);

  console.log(
    `[API DEBUG] Found ${logs.length} logs in Redis for ${deploymentId}`,
  );

  await syncDeploymentFromMetadata(db, deploymentId, metadata);

  return c.json({
    logs: parseLogEvents(logs),
    deployment: metadata,
  });
});

projectsRouter.get("/:deploymentId/logs/stream", async (c) => {
  const db = c.get("db");

  if (!redis) {
    return c.json({ error: "Redis is not configured" }, 500);
  }

  console.log(
    "[API DEBUG] Starting log stream for deployment",
    c.req.param("deploymentId"),
  );

  const idParam = c.req.param("deploymentId");
  let deploymentId = idParam;

  const projectWithLatest = await db.query.projects.findFirst({
    where: eq(projects.slug, idParam),
  });

  if (projectWithLatest) {
    const [latest] = await db
      .select()
      .from(deployments)
      .where(eq(deployments.projectId, projectWithLatest.id))
      .orderBy(desc(deployments.createdAt))
      .limit(1);

    if (latest) {
      deploymentId = latest.id;
    }
  }

  console.log(deploymentId);

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
          const [logs, deployment] = await Promise.all([
            redis.lrange(logsKey, 0, -1),
            redis.hgetall(deploymentKey),
          ]);

          await syncDeploymentFromMetadata(db, deploymentId, deployment);

          const parsedLogs = parseLogEvents(logs);
          for (const logEvent of parsedLogs) {
            if (sentLogIds.has(logEvent.id)) continue;
            sentLogIds.add(logEvent.id);
            send("log", logEvent);
          }

          send("deployment", deployment);
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
