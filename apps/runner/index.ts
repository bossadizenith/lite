import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { exec as execCallback } from "child_process";
import { promisify } from "util";

const exec = promisify(execCallback);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const ARTIFACT_URL = process.env.ARTIFACT_URL;
const APP_DIR = path.join(__dirname, "app");

async function downloadAndExtract() {
  if (!ARTIFACT_URL) {
    console.error("Error: ARTIFACT_URL environment variable is missing.");
    process.exit(1);
  }

  const url = new URL(ARTIFACT_URL);
  const bucket = url.hostname;
  const key = url.pathname.startsWith("/")
    ? url.pathname.slice(1)
    : url.pathname;

  console.log(`Downloading artifact from s3://${bucket}/${key}...`);

  const response = await s3Client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
  );

  if (!fs.existsSync(APP_DIR)) {
    fs.mkdirSync(APP_DIR, { recursive: true });
  }

  const tarballPath = path.join(__dirname, "artifact.tar.gz");
  const writer = fs.createWriteStream(tarballPath);

  // @ts-ignore - Body is a stream in node
  response.Body.pipe(writer);

  await new Promise<void>((resolve, reject) => {
    writer.on("finish", () => resolve());
    writer.on("error", (err) => reject(err));
  });

  console.log("Extracting artifact...");
  await exec(`tar -xzf ${tarballPath} -C ${APP_DIR}`);
  fs.unlinkSync(tarballPath);

  console.log("Artifact extracted successfully.");
}

async function startApp() {
  console.log("Starting application...");

  const child = spawn("npm", ["start"], {
    cwd: APP_DIR,
    stdio: "inherit",
    env: { ...process.env, PORT: process.env.PORT || "3000" },
  });

  child.on("close", (code) => {
    console.log(`Application exited with code ${code}`);
    process.exit(code || 0);
  });

  child.on("error", (err) => {
    console.error("Failed to start application:", err);
    process.exit(1);
  });
}

async function main() {
  try {
    await downloadAndExtract();
    await startApp();
  } catch (error) {
    console.error("Bootstrap failed:", error);
    process.exit(1);
  }
}

main();
