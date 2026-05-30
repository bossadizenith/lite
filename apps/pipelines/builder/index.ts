import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { exec as execCallback, spawn } from "child_process";
import fs from "fs";
import { Redis } from "ioredis";
import path from "path";
import { fileURLToPath } from "url";
import { promisify } from "util";
import {
  detectFramework,
  type Framework,
  type PackageManager,
} from "./framework-detection.js";

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

const BUILD_ENV = {
  ...process.env,
  FORCE_COLOR: "1",
};

function inferLogLevel(message: string): "info" | "warn" | "error" {
  if (/\b(ERR!|error:|failed|FAIL)\b/i.test(message)) {
    return "error";
  }
  if (/\b(warn|warning)\b/i.test(message)) {
    return "warn";
  }
  return "info";
}

function streamChunkToLogs(data: Buffer) {
  const message = data.toString().trim();
  if (!message) return;
  void publishLog(message, inferLogLevel(message));
}

function runShellCommand(command: string, cwd: string, label: string) {
  return new Promise<void>((resolve, reject) => {
    void publishLog(label);

    const child = spawn(command, {
      cwd,
      shell: true,
      env: BUILD_ENV,
    });

    child.stdout?.on("data", (data: Buffer) => {
      process.stdout.write(data);
      streamChunkToLogs(data);
    });

    child.stderr?.on("data", (data: Buffer) => {
      process.stderr.write(data);
      streamChunkToLogs(data);
    });

    child.on("error", (err) => {
      reject(err);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Command failed with exit code ${code}: ${command}`));
    });
  });
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
  const git = await readGitMetadata(outDirPath);

  if (redis) {
    await redis.hset(DEPLOYMENT_KEY, {
      lastCommitMessage: git.lastCommitMessage,
      lastCommitAuthor: git.lastCommitAuthor,
      lastDeploymentBranch: git.lastDeploymentBranch,
      lastCommitHash: git.lastCommitHash,
    });
  }

  const results = await detectFramework(outDirPath);
  const framework: Framework = results.framework;
  const pm: PackageManager = results.packageManager;

  await publishLog(
    `Detected framework: ${framework}, packageManager: ${pm}, rootDir: ${results.rootDir}, confidence: ${results.confidence}`,
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
      : "Next.js (output: .next/ or out/)";

  await publishLog(`Building ${buildDescription} in ${appRoot}...`);

  try {
    await runShellCommand(
      `${pm} install`,
      appRoot,
      "Installing dependencies...",
    );
    await runShellCommand(
      `${pm} run build`,
      appRoot,
      "Running production build...",
    );
  } catch (err) {
    const error = err as Error;
    console.error("Build process failed:", error);
    await publishLog(error.message, "error");
    await markDeploymentError();
    process.exit(1);
  }

  console.log("Build Complete");
  await publishLog("Build complete", "success");

  let isBuildValid = false;

  if (framework === "vite" && fs.existsSync(path.join(appRoot, "dist"))) {
    isBuildValid = true;
  } else if (framework === "nextjs") {
    const hasOut = fs.existsSync(path.join(appRoot, "out"));
    const hasDotNext = fs.existsSync(path.join(appRoot, ".next"));
    if (hasOut || hasDotNext) {
      isBuildValid = true;
    }
  }

  if (!isBuildValid) {
    const expectedOut = framework === "vite" ? "dist/" : ".next/ or out/";
    const errorMsg = `Error: Build output not found. Expected ${expectedOut} to be produced.`;
    console.error(errorMsg);
    await publishLog(errorMsg, "error");
    await markDeploymentError();
    process.exit(1);
  }

  try {
    await publishLog("Packaging deployment artifacts...");

    const tarballName = `deployment-${DEPLOYMENT_ID}.tar.gz`;
    const tarballPath = path.join(__dirname, tarballName);

    const liteMetaPath = path.join(outDirPath, "lite.json");
    fs.writeFileSync(
      liteMetaPath,
      JSON.stringify({
        rootDir: results.rootDir,
        packageManager: pm,
        framework,
      }),
      "utf-8",
    );

    await execAsync(`tar --exclude='./${tarballName}' -czf ${tarballPath} .`, {
      cwd: outDirPath,
    });

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
        framework,
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
}

async function readGitMetadata(rootDir: string) {
  const run = async (cmd: string) => {
    try {
      const { stdout } = await execAsync(cmd, { cwd: rootDir });
      return stdout.trim();
    } catch {
      return "";
    }
  };
  const [
    lastCommitMessage,
    lastCommitAuthor,
    lastDeploymentBranch,
    lastCommitHash,
  ] = await Promise.all([
    run(`git log -1 --format='%s'`),
    run(`git log -1 --format='%an'`),
    run(`git branch --show-current`),
    run(`git rev-parse HEAD`),
  ]);

  return {
    lastCommitMessage,
    lastCommitAuthor,
    lastDeploymentBranch,
    lastCommitHash,
  };
}

init().catch(async (err) => {
  console.error("Initial execution failed", err);
  try {
    await markDeploymentError();
  } catch {}
  process.exit(1);
});
