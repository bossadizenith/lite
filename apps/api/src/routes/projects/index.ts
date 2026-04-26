import { ECSClient, RunTaskCommand } from "@aws-sdk/client-ecs";
import { projects } from "@lite/db/schema";
import { env } from "@lite/env/server.js";
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

function parseLogEvents(rawLogs: string[]): LogEvent[] {
  return rawLogs.flatMap((rawLog) => {
    try {
      return [JSON.parse(rawLog) as LogEvent];
    } catch {
      return [];
    }
  });
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
  } catch (error) {
    console.error("Error running ECS task:", error);
    return c.json({ error: "Failed to start build" }, 500);
  }

  return c.json(project);
});

projectsRouter.get("/:deploymentId/logs", async (c) => {
  if (!redis) {
    return c.json({ error: "Redis is not configured" }, 500);
  }

  const deploymentId = c.req.param("deploymentId");
  const logsKey = `logs:${deploymentId}`;
  const deploymentKey = `deployment:${deploymentId}`;

  const [logs, metadata] = await Promise.all([
    redis.lrange(logsKey, 0, -1),
    redis.hgetall(deploymentKey),
  ]);

  return c.json({
    logs: parseLogEvents(logs),
    deployment: metadata,
  });
});

projectsRouter.get("/:deploymentId/logs/stream", async (c) => {
  if (!redis) {
    return c.json({ error: "Redis is not configured" }, 500);
  }

  const deploymentId = c.req.param("deploymentId");
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
