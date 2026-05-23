import "./utils/load-env.js";

import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { db } from "@lite/db";
import { projects, deployments } from "@lite/db/schema.js";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { proxy } from "hono/proxy";
import { handle } from "hono/vercel";
import { env } from "@lite/env/server.js";

const app = new Hono();

const GENERIC_S3_CONTENT_TYPES = new Set([
  "application/octet-stream",
  "binary/octet-stream",
]);

function contentTypeForPath(
  pathname: string,
  fromS3: string | undefined,
): string {
  const trimmed = fromS3?.trim() ?? "";
  if (
    trimmed &&
    !GENERIC_S3_CONTENT_TYPES.has(trimmed.toLowerCase().split(";")[0] ?? "")
  ) {
    return trimmed;
  }
  const dot = pathname.lastIndexOf(".");
  const ext = dot >= 0 ? pathname.slice(dot).toLowerCase() : "";
  const byExt: Record<string, string> = {
    ".html": "text/html; charset=utf-8",
    ".htm": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".cjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
    ".woff2": "font/woff2",
    ".woff": "font/woff",
    ".ttf": "font/ttf",
    ".map": "application/json; charset=utf-8",
    ".txt": "text/plain; charset=utf-8",
    ".xml": "application/xml",
    ".webmanifest": "application/manifest+json",
  };
  return byExt[ext] ?? "application/octet-stream";
}

const s3 = new S3Client({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
});

app.all("*", async (c) => {
  const host = c.req.header("host") || "";
  const hostname = host.split(":")[0];
  const url = new URL(c.req.url);

  const slug = hostname.split(".")[0];

  const project = await db.query.projects.findFirst({
    where: eq(projects.slug, slug),
  });

  if (!project) {
    return c.text("Project not found", 404);
  }

  const deploymentId = project.currentDeploymentId;
  if (!deploymentId) {
    return c.text("No active deployment for this project", 404);
  }

  const deployment = await db.query.deployments.findFirst({
    where: eq(deployments.id, deploymentId),
  });

  if (!deployment) {
    return c.text("Active deployment not found", 404);
  }

  // if (deployment.type === "container" || deployment.type === "static") {
  if (!deployment.ipAddress) {
    return c.text("Container IP address not yet assigned", 503);
  }
  const port = deployment.runtimePort ?? 5000;
  const upstreamUrl = `http://${deployment.ipAddress}:${port}${url.pathname}${url.search}`;

  console.log(`Proxying to container: ${upstreamUrl}`);

  try {
    const res = await proxy(upstreamUrl, {
      headers: {
        ...c.req.header(),
        "X-Forwarded-Host": hostname,
        "X-Forwarded-Proto": url.protocol.replace(":", ""),
        "X-Forwarded-For": c.req.header("x-forwarded-for") || "",
      },
    });

    const location = res.headers.get("Location");
    if (location) {
      const internalBaseUrl = `http://${deployment.ipAddress}:${port}`;
      if (location.startsWith(internalBaseUrl)) {
        const relativePath = location.slice(internalBaseUrl.length);
        const rewrittenResponse = new Response(res.body, res);
        rewrittenResponse.headers.set("Location", relativePath);
        return rewrittenResponse;
      }
    }

    return res;
  } catch (proxyErr) {
    console.error("Upstream proxy error:", proxyErr);
    return c.text("Service Unavailable", 503);
  }
  // }
});

export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const DELETE = handle(app);

export default app;
