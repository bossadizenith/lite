import {
  ECSClient,
  RunTaskCommand,
  DescribeTasksCommand,
} from "@aws-sdk/client-ecs";
import {
  EC2Client,
  DescribeNetworkInterfacesCommand,
} from "@aws-sdk/client-ec2";
import { deploymentStatusEnum, deployments, projects } from "@lite/db/schema";
import { env } from "@lite/env/server.js";
import { and, desc, eq, inArray } from "drizzle-orm";
import Redis from "ioredis";
import type { ReqVariables } from "../utils/hono.js";

const ecsClient = new ECSClient({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
});

const ec2Client = new EC2Client({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
});

const CONFIG = {
  CLUSTER: env.ECS_CLUSTER_ARN,
  TASK: env.ECS_TASK_DEFINITION_ARN,
  RUNNER_TASK: env.RUNNER_ECS_TASK_DEFINITION_ARN,
};

export const redis = new Redis(env.REDIS_URL);

export type LogEvent = {
  id: string;
  timestamp: number;
  level: "info" | "error" | "success" | "warn";
  message: string;
  source?: "build" | "system";
};

type DeploymentDbStatus = (typeof deploymentStatusEnum.enumValues)[number];
type DbClient = ReqVariables["db"];
export type DeploymentMetadata = Record<string, string>;

const HEALTHCHECK_ATTEMPTS = 5;
const ACTIVE_DB_STATUSES: DeploymentDbStatus[] = [
  "queued",
  "building",
  "built",
  "deploying",
];
const rolloutsInFlight = new Set<string>();

export function parseLogEvents(rawLogs: string[]): LogEvent[] {
  return rawLogs.flatMap((rawLog) => {
    try {
      return [JSON.parse(rawLog) as LogEvent];
    } catch {
      return [];
    }
  });
}

export function resolveRuntimePort(
  deploymentType?: string,
  framework?: string,
): number {
  if (framework === "vite" || deploymentType === "static") {
    return 4173;
  }
  if (framework === "nextjs" || deploymentType === "container") {
    return 3000;
  }
  return 5000;
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

async function setDeploymentRedisStatus(
  deploymentId: string,
  fields: DeploymentMetadata,
) {
  await redis.hset(`deployment:${deploymentId}`, fields);
}

export async function enrichDeploymentMetadata(
  db: DbClient,
  deploymentId: string,
  metadata: DeploymentMetadata,
): Promise<DeploymentMetadata> {
  const [row] = await db
    .select({ status: deployments.status })
    .from(deployments)
    .where(eq(deployments.id, deploymentId))
    .limit(1);

  const dbStatus = row?.status;
  if (dbStatus === "healthy") {
    return { ...metadata, status: "healthy" };
  }
  if (dbStatus === "deploying") {
    return { ...metadata, status: "deploying" };
  }
  if (dbStatus === "failed") {
    return { ...metadata, status: "failed" };
  }

  return metadata;
}

export async function persistDeploymentLogs(
  db: DbClient,
  deploymentId: string,
) {
  const logsKey = `logs:${deploymentId}`;
  const rawLogs = await redis.lrange(logsKey, 0, -1);
  const parsed = parseLogEvents(rawLogs);
  if (parsed.length === 0) return;

  await db
    .update(deployments)
    .set({
      logs: parsed,
      updatedAt: new Date(),
    })
    .where(eq(deployments.id, deploymentId));
}

async function updateDeploymentGitFromMetadata(
  db: DbClient,
  deploymentId: string,
  projectId: string,
  metadata: DeploymentMetadata,
) {
  const gitUpdate: Partial<{
    lastCommitMessage: string;
    lastCommitAuthor: string;
    lastDeploymentBranch: string;
    lastCommitHash: string;
  }> = {};

  if (metadata.lastCommitMessage) {
    gitUpdate.lastCommitMessage = metadata.lastCommitMessage;
  }
  if (metadata.lastCommitAuthor) {
    gitUpdate.lastCommitAuthor = metadata.lastCommitAuthor;
  }
  if (metadata.lastDeploymentBranch) {
    gitUpdate.lastDeploymentBranch = metadata.lastDeploymentBranch;
  }
  if (metadata.lastCommitHash) {
    gitUpdate.lastCommitHash = metadata.lastCommitHash;
  }

  if (Object.keys(gitUpdate).length === 0) return;

  await db
    .update(projects)
    .set({
      ...gitUpdate,
      updatedAt: new Date(),
    })
    .where(eq(projects.id, projectId));

  await db
    .update(deployments)
    .set({
      ...(gitUpdate.lastCommitMessage
        ? { commitMessage: gitUpdate.lastCommitMessage }
        : {}),
      ...(gitUpdate.lastCommitAuthor
        ? { commitAuthor: gitUpdate.lastCommitAuthor }
        : {}),
      ...(gitUpdate.lastDeploymentBranch
        ? { branch: gitUpdate.lastDeploymentBranch }
        : {}),
      ...(gitUpdate.lastCommitHash
        ? { commitHash: gitUpdate.lastCommitHash }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(deployments.id, deploymentId));
}

export async function syncDeploymentFromMetadata(
  db: DbClient,
  deploymentId: string,
  metadata: DeploymentMetadata,
) {
  const dbStatus = toDeploymentDbStatus(metadata.status);
  if (!dbStatus) return;

  const [deploymentRecord] = await db
    .select({
      projectId: deployments.projectId,
      status: deployments.status,
    })
    .from(deployments)
    .where(eq(deployments.id, deploymentId))
    .limit(1);

  if (!deploymentRecord) return;

  await updateDeploymentGitFromMetadata(
    db,
    deploymentId,
    deploymentRecord.projectId,
    metadata,
  );

  if (
    deploymentRecord.status === "deploying" ||
    deploymentRecord.status === "healthy" ||
    deploymentRecord.status === dbStatus
  ) {
    if (deploymentRecord.status === "built") {
      void rolloutRuntimeDeployment(db, deploymentId);
    }
    if (dbStatus === "healthy" || dbStatus === "failed") {
      await persistDeploymentLogs(db, deploymentId);
    }
    return;
  }

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
    await db
      .update(projects)
      .set({
        currentDeploymentId: deploymentId,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, deploymentRecord.projectId));
  }

  if (dbStatus === "built") {
    const deploymentType =
      metadata.deploymentType === "container" ? "container" : "static";

    await db
      .update(deployments)
      .set({
        type: deploymentType,
        runtimePort: resolveRuntimePort(
          metadata.deploymentType,
          metadata.framework,
        ),
        imageUrl: metadata.imageUrl,
        ...(metadata.artifactUrl ? { url: metadata.artifactUrl } : {}),
      })
      .where(eq(deployments.id, deploymentId));

    void rolloutRuntimeDeployment(db, deploymentId);
  }

  if (dbStatus === "failed") {
    await persistDeploymentLogs(db, deploymentId);
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

      let response = await fetch(`https://${url}`, {
        signal: controller.signal,
      }).catch(() => fetch(`http://${url}`, { signal: controller.signal }));

      clearTimeout(timeout);

      if (
        response &&
        (response.ok || response.status === 301 || response.status === 302)
      ) {
        return true;
      }
    } catch {
      /* probe retries below */
    }

    await sleep(2000);
  }

  return false;
}

export async function rolloutRuntimeDeployment(
  db: DbClient,
  deploymentId: string,
) {
  if (rolloutsInFlight.has(deploymentId)) return;
  rolloutsInFlight.add(deploymentId);

  try {
    const [resultRecord] = await db
      .select({
        deployment: deployments,
        project: projects,
      })
      .from(deployments)
      .innerJoin(projects, eq(projects.id, deployments.projectId))
      .where(eq(deployments.id, deploymentId))
      .limit(1);

    const deployment = resultRecord?.deployment;
    const project = resultRecord?.project;

    if (!deployment || deployment.status !== "built") {
      return;
    }

    await db
      .update(deployments)
      .set({
        status: "deploying",
        updatedAt: new Date(),
      })
      .where(eq(deployments.id, deploymentId));

    await setDeploymentRedisStatus(deploymentId, { status: "deploying" });

    const command = new RunTaskCommand({
      cluster: CONFIG.CLUSTER,
      taskDefinition: CONFIG.RUNNER_TASK,
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
            name: "runner",
            command: ["npm", "start"],
            environment: [
              { name: "ARTIFACT_URL", value: deployment.url },
              { name: "AWS_ACCESS_KEY_ID", value: env.AWS_ACCESS_KEY_ID },
              {
                name: "AWS_SECRET_ACCESS_KEY",
                value: env.AWS_SECRET_ACCESS_KEY,
              },
              { name: "AWS_REGION", value: env.AWS_REGION },
              {
                name: "PORT",
                value: String(
                  deployment.runtimePort ?? resolveRuntimePort(deployment.type),
                ),
              },
              ...Object.entries(
                (project.envVars as Record<string, string>) || {},
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

    let eniId = "";
    for (let i = 0; i < 60; i++) {
      await sleep(2000);
      const describeTask = new DescribeTasksCommand({
        cluster: CONFIG.CLUSTER,
        tasks: [taskArn],
      });
      const taskDetails = await ecsClient.send(describeTask);
      const taskInfo = taskDetails.tasks?.[0];

      if (taskInfo?.lastStatus === "RUNNING") {
        const eniDetail = taskInfo.attachments?.[0]?.details?.find(
          (d) => d.name === "networkInterfaceId",
        );
        if (eniDetail && eniDetail.value) {
          eniId = eniDetail.value;
          break;
        }
      } else if (taskInfo?.lastStatus === "STOPPED") {
        throw new Error("Task stopped before reaching RUNNING state");
      }
    }

    if (!eniId) {
      throw new Error("Failed to retrieve ENI for the running task");
    }

    const describeNetwork = new DescribeNetworkInterfacesCommand({
      NetworkInterfaceIds: [eniId],
    });
    const networkDetails = await ec2Client.send(describeNetwork);
    const publicIp =
      networkDetails.NetworkInterfaces?.[0]?.Association?.PublicIp;

    if (!publicIp) {
      throw new Error("Failed to retrieve Public IP for the ENI");
    }

    const port = deployment.runtimePort ?? resolveRuntimePort(deployment.type);
    const ipUrl = `${publicIp}:${port}`;

    const healthy = await isDeploymentHealthy(ipUrl);

    if (!healthy) {
      throw new Error("Runtime health check failed after rollout");
    }

    await db
      .update(deployments)
      .set({
        status: "healthy",
        ipAddress: publicIp,
        finishedAt: new Date(),
        updatedAt: new Date(),
        taskDefinitionArn: taskArn,
      })
      .where(eq(deployments.id, deploymentId));

    await db
      .update(projects)
      .set({
        currentDeploymentId: deploymentId,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, deployment.projectId));

    await setDeploymentRedisStatus(deploymentId, { status: "healthy" });
    await persistDeploymentLogs(db, deploymentId);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    await db
      .update(deployments)
      .set({
        status: "failed",
        errorMessage,
        finishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(deployments.id, deploymentId));

    await setDeploymentRedisStatus(deploymentId, {
      status: "failed",
      errorMessage,
    });
    await persistDeploymentLogs(db, deploymentId);
  } finally {
    rolloutsInFlight.delete(deploymentId);
  }
}

export async function syncActiveDeployments(db: DbClient) {
  const activeRows = await db
    .select({ id: deployments.id })
    .from(deployments)
    .where(inArray(deployments.status, ACTIVE_DB_STATUSES))
    .orderBy(desc(deployments.createdAt))
    .limit(50);

  for (const row of activeRows) {
    const deploymentKey = `deployment:${row.id}`;
    const metadata = await redis.hgetall(deploymentKey);
    if (Object.keys(metadata).length > 0) {
      await syncDeploymentFromMetadata(db, row.id, metadata);
    }
  }
}

export async function startBuildTask({
  projectSlug,
  deploymentId,
  repoUrl,
  envVars,
}: {
  projectSlug: string;
  deploymentId: string;
  repoUrl: string;
  envVars: Record<string, string>;
}) {
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
            { name: "PROJECT_ID", value: projectSlug },
            { name: "DEPLOYMENT_ID", value: deploymentId },
            { name: "AWS_ACCESS_KEY_ID", value: env.AWS_ACCESS_KEY_ID },
            { name: "AWS_SECRET_ACCESS_KEY", value: env.AWS_SECRET_ACCESS_KEY },
            { name: "AWS_REGION", value: env.AWS_REGION },
            { name: "REDIS_URL", value: env.REDIS_URL },
            ...Object.entries(envVars).map(([name, value]) => ({
              name,
              value: String(value),
            })),
          ],
        },
      ],
    },
  });

  await ecsClient.send(command);
}

export async function resolveDeploymentId(
  db: DbClient,
  idParam: string,
): Promise<string | null> {
  const project = await db.query.projects.findFirst({
    where: eq(projects.slug, idParam),
  });

  if (project) {
    const [latest] = await db
      .select({ id: deployments.id })
      .from(deployments)
      .where(eq(deployments.projectId, project.id))
      .orderBy(desc(deployments.createdAt))
      .limit(1);

    return latest?.id ?? null;
  }

  const [deployment] = await db
    .select({ id: deployments.id })
    .from(deployments)
    .where(eq(deployments.id, idParam))
    .limit(1);

  return deployment?.id ?? null;
}

export async function getDeploymentLogs(
  db: DbClient,
  deploymentId: string,
): Promise<LogEvent[]> {
  const [row] = await db
    .select({
      logs: deployments.logs,
      status: deployments.status,
    })
    .from(deployments)
    .where(eq(deployments.id, deploymentId))
    .limit(1);

  const terminalStatuses: DeploymentDbStatus[] = ["healthy", "failed"];
  if (row?.logs && row.status && terminalStatuses.includes(row.status)) {
    return row.logs as LogEvent[];
  }

  const rawLogs = await redis.lrange(`logs:${deploymentId}`, 0, -1);
  return parseLogEvents(rawLogs);
}
