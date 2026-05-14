import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { exec as execCallback, spawn } from "child_process";
import fs from "fs";
import { Redis } from "ioredis";
import path from "path";
import { fileURLToPath } from "url";
import { promisify } from "util";
import { detectFramework, type Framework } from "./framework-detection.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const execAsync = promisify(execCallback);

const s3Client = new S3Client({
  region: String(process.env.AWS_REGION),
  credentials: {
    accessKeyId: String(process.env.AWS_ACCESS_KEY_ID),
    secretAccessKey: String(process.env.AWS_SECRET_ACCESS_KEY),
  },
});

const PROJECT_ID = process.env.PROJECT_ID;
const DEPLOYMENT_ID = process.env.DEPLOYMENT_ID ?? PROJECT_ID;
const REDIS_URL = process.env.REDIS_URL;
const LOGS_KEY = `logs:${DEPLOYMENT_ID}`;
const DEPLOYMENT_KEY = `deployment:${DEPLOYMENT_ID}`;
const MAX_LOG_EVENTS = 1000;
const LOG_TTL_SECONDS = 60 * 60;

const redis = REDIS_URL
  ? new Redis(String(REDIS_URL), {
      maxRetriesPerRequest: 1,
      connectTimeout: 5000,
    })
  : null;

if (redis) {
  redis.on("error", (err) => {
    console.error("Redis Client Error:", err);
  });
}

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

  console.log(`[LOG]-${DEPLOYMENT_ID}: ${payload}`);

  if (!redis) return;

  try {
    await Promise.all([
      redis.rpush(LOGS_KEY, payload),
      redis.publish(LOGS_KEY, payload),
    ]);
    await redis.expire(LOGS_KEY, LOG_TTL_SECONDS);
  } catch (err) {
    console.error("Failed to push log to Redis:", err);
  }
}

async function init() {
  if (redis) {
    await redis.hset(DEPLOYMENT_KEY, {
      status: "running",
      startedAt: Date.now().toString(),
      projectId: PROJECT_ID,
      deploymentId: DEPLOYMENT_ID,
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

  const p = spawn("npm install && npm run build", {
    cwd: appRoot,
    shell: true,
    env: { ...process.env, FORCE_COLOR: "1" },
  });

  if (p.stdout) {
    p.stdout.on("data", async function (data: Buffer) {
      const message = data.toString().trim();
      if (message) {
        console.log(message);
        await publishLog(message);
      }
    });
  }

  if (p.stderr) {
    p.stderr.on("data", async function (data: Buffer) {
      const message = data.toString().trim();
      if (message) {
        console.error("Error", message);
        await publishLog(message, "error");
      }
    });
  }

  p.on("error", async (err) => {
    console.error("Process Error:", err);
    await publishLog(`Failed to start build process: ${err.message}`, "error");
  });

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
      await publishLog("Packaging deployment artifacts...");

      const tarballName = `deployment-${DEPLOYMENT_ID}.tar.gz`;
      const tarballPath = path.join(__dirname, tarballName);

      // Create a tarball of the build output and necessary files
      // We include everything except the output directory itself to avoid recursion
      // For Next.js, we MUST have .next, node_modules, public, package.json
      await execAsync(
        `tar --exclude='./output' --exclude='./${tarballName}' -czf ${tarballPath} .`,
        { cwd: appRoot },
      );

      await publishLog(`Uploading deployment bundle: ${tarballName}`);

      const command = new PutObjectCommand({
        Bucket: "vercel-lite-clone",
        Key: `__deployments/${PROJECT_ID}/${tarballName}`,
        Body: fs.createReadStream(tarballPath),
        ContentType: "application/gzip",
      });

      await s3Client.send(command);
      await publishLog("Deployment bundle uploaded successfully", "success");

      if (redis) {
        await redis.hset(DEPLOYMENT_KEY, {
          status: "success",
          finishedAt: Date.now().toString(),
          artifactUrl: `s3://vercel-lite-clone/__deployments/${PROJECT_ID}/${tarballName}`,
          deploymentType: framework === "nextjs" ? "container" : "static",
        });
      }

      if (fs.existsSync(tarballPath)) {
        fs.unlinkSync(tarballPath);
      }

      console.log("Done...");
      process.exit(0);
    } catch (err) {
      const error = err as Error;
      console.error("Packaging/Upload failed", error);
      await publishLog(`Packaging/Upload failed: ${error.message}`, "error");
      await markDeploymentError();
      process.exit(1);
    }
  });
}

init().catch(async (err) => {
  console.error("Initial execution failed", err);
  try {
    await markDeploymentError();
  } catch {}
  process.exit(1);
});
