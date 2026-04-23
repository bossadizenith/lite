import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { exec } from "child_process";
import fs from "fs";
import mime from "mime-types";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const PROJECT_ID = process.env.PROJECT_ID;

function publishLog(log) {
  console.log(`[LOG]-${PROJECT_ID}: ${log}`);
}

async function init() {
  console.log("Executing script.js");
  publishLog("Build Started...");
  const outDirPath = path.join(__dirname, "output");

  const p = exec(`cd ${outDirPath} && npm install && npm run build`);

  p.stdout.on("data", function (data) {
    console.log(data.toString());
    publishLog(data.toString());
  });

  p.stdout.on("error", function (data) {
    console.log("Error", data.toString());
    publishLog(`error: ${data.toString()}`);
  });

  p.on("close", async function (code) {
    if (code !== 0) {
      console.error(`Build failed with exit code ${code}`);
      publishLog(`Build failed with exit code ${code}`);
      process.exit(1);
    }

    console.log("Build Complete");
    publishLog(`Build Complete`);
    const distFolderPath = path.join(__dirname, "output", "dist");

    if (!fs.existsSync(distFolderPath)) {
      const errorMsg = `Error: Build output directory 'dist' not found at ${distFolderPath}. Please check if your project build command is correct.`;
      console.error(errorMsg);
      publishLog(errorMsg);
      process.exit(1);
    }

    try {
      const distFolderContents = fs.readdirSync(distFolderPath, {
        recursive: true,
      });

      publishLog(`Starting to upload`);
      for (const file of distFolderContents) {
        const filePath = path.join(distFolderPath, file);
        if (fs.lstatSync(filePath).isDirectory()) continue;

        console.log("uploading", filePath);
        publishLog(`uploading ${file}`);

        const command = new PutObjectCommand({
          Bucket: "vercel-lite-clone",
          Key: `__outputs/${PROJECT_ID}/${file}`,
          Body: fs.createReadStream(filePath),
          ContentType: mime.lookup(filePath),
        });

        await s3Client.send(command);
        publishLog(`uploaded ${file}`);
        console.log("uploaded", filePath);
      }
      publishLog(`Done`);
      console.log("Done...");
      process.exit(0);
    } catch (err) {
      console.error("Upload failed", err);
      publishLog(`Upload failed: ${err.message}`);
      process.exit(1);
    }
  });
}

init().catch((err) => {
  console.error("Initial execution failed", err);
  process.exit(1);
});
