import { ECSClient, RunTaskCommand } from "@aws-sdk/client-ecs";
import { projects } from "@lite/db/schema";
import { env } from "@lite/env/server.js";
import { Hono } from "hono";
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
      subDomain: `${finalSlug}.localhost`,
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

export default projectsRouter;
