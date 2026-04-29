import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { exec } from "child_process";
import fs from "fs";
import { Redis } from "ioredis";
import path from "path";
import { fileURLToPath } from "url";
import {
  detectFramework,
  type Framework,
} from "./framework-detection.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const s3Client = new S3Client({
  region: String(process.env.AWS_REGION),
  credentials: {
    accessKeyId: String(process.env.AWS_ACCESS_KEY_ID),
    secretAccessKey: String(process.env.AWS_SECRET_ACCESS_KEY),
  },
});

const PROJECT_ID = process.env.PROJECT_ID;
const REDIS_URL = process.env.REDIS_URL;
const LOGS_KEY = `logs:${PROJECT_ID}`;
const DEPLOYMENT_KEY = `deployment:${PROJECT_ID}`;
const MAX_LOG_EVENTS = 1000;
const LOG_TTL_SECONDS = 60 * 60;

const redis = REDIS_URL ? new Redis(String(REDIS_URL)) : null;
let logSequence = 0;

function createLogEvent(message: string, level = "info", source = "build") {
  logSequence += 1;
  return {
    id: `log_${logSequence}`,
    timestamp: Date.now(),
    level,
    message,
    source,
  };
}

async function markDeploymentError() {
  if (redis) {
    await redis.hset(DEPLOYMENT_KEY, {
      status: "error",
      finishedAt: Date.now().toString(),
    });
  }
}

async function publishLog(message: string, level = "info", source = "build") {
  const event = createLogEvent(message, level, source);
  const payload = JSON.stringify(event);

  console.log(`[LOG]-${PROJECT_ID}: ${payload}`);

  if (!redis) {
    return;
  }

  await redis.rpush(LOGS_KEY, payload);
  await redis.publish(LOGS_KEY, payload);
  await redis.ltrim(LOGS_KEY, -MAX_LOG_EVENTS, -1);
  await redis.expire(LOGS_KEY, LOG_TTL_SECONDS);
}

async function init() {
  if (redis) {
    await redis.hset(DEPLOYMENT_KEY, {
      status: "running",
      startedAt: Date.now().toString(),
      projectId: PROJECT_ID,
    });
    await redis.expire(DEPLOYMENT_KEY, LOG_TTL_SECONDS);
  }

  await publishLog("Build started...");
  const outDirPath = path.join(__dirname, "output");

  const results = await detectFramework(outDirPath);
  const framework: Framework = results.framework;

  await publishLog(
    `Detected framework: ${framework}, rootDir: ${results.rootDir}, confidence: ${results.confidence}`,
  );

  if (framework === "unknown") {
    await publishLog(
      "Unknown framework: could not detect Next.js or Vite in this repository.",
      "error",
    );
    await markDeploymentError();
    process.exit(1);
  }

  const appRoot =
    results.rootDir === "."
      ? outDirPath
      : path.join(outDirPath, results.rootDir);

  const artifactDir =
    framework === "vite"
      ? path.join(appRoot, "dist")
      : path.join(appRoot, "out");

  const buildDescription =
    framework === "vite"
      ? "Vite (output: dist/)"
      : "Next.js static export (output: out/ — set output: 'export' in next.config)";

  await publishLog(`Building ${buildDescription} in ${appRoot}...`);

  const p = exec("npm install && npm run build", { cwd: appRoot });

  if (p.stdout) {
    p.stdout.on("data", async function (data: Buffer) {
      console.log(data.toString());
      await publishLog(data.toString().trim());
    });
  }

  if (p.stderr) {
    p.stderr.on("data", async function (data: Buffer) {
      console.log("Error", data.toString());
      await publishLog(data.toString().trim(), "error");
    });
  }

  p.on("close", async function (code: number | null) {
    if (code !== 0) {
      console.error(`Build failed with exit code ${code}`);
      await publishLog(`Build failed with exit code ${code}`, "error");
      await markDeploymentError();
      process.exit(1);
    }

    console.log("Build Complete");
    await publishLog("Build complete", "success");

    if (!fs.existsSync(artifactDir)) {
      const nextHint =
        framework === "nextjs"
          ? " For full SSR use a container runtime; for static hosting add output: 'export' to next.config so `out/` is produced."
          : "";
      const errorMsg = `Error: Build output not found at ${artifactDir}.${nextHint}`;
      console.error(errorMsg);
      await publishLog(errorMsg, "error");
      await markDeploymentError();
      process.exit(1);
    }

    try {
      const distFolderContents = fs.readdirSync(artifactDir, {
        recursive: true,
      }) as string[];

      await publishLog("Starting upload phase...");
      for (const file of distFolderContents) {
        const filePath = path.join(artifactDir, file);
        if (fs.lstatSync(filePath).isDirectory()) continue;

        console.log("uploading", filePath);
        await publishLog(`Uploading ${file}`);

        const command = new PutObjectCommand({
          Bucket: "vercel-lite-clone",
          Key: `__outputs/${PROJECT_ID}/${file}`,
          Body: fs.createReadStream(filePath),
        });

        await s3Client.send(command);
        await publishLog(`Uploaded ${file}`, "success");
        console.log("uploaded", filePath);
      }
      await publishLog("Deployment artifacts uploaded", "success");
      if (redis) {
        await redis.hset(DEPLOYMENT_KEY, {
          status: "success",
          finishedAt: Date.now().toString(),
        });
      }
      console.log("Done...");
      process.exit(0);
    } catch (err) {
      const error = err as Error;
      console.error("Upload failed", error);
      await publishLog(`Upload failed: ${error.message}`, "error");
      await markDeploymentError();
      process.exit(1);
    }
  });
}

init().catch(async (err) => {
  console.error("Initial execution failed", err);
  try {
    await markDeploymentError();
  } catch {
    /* ignore secondary failures */
  }
  process.exit(1);
});
