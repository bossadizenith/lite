import "./utils/load-env.js";

// noti

import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { db } from "@lite/db";
import { projects } from "@lite/db/schema.js";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
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

  let pathname = url.pathname;
  if (pathname === "/") {
    pathname = "/index.html";
  }

  const key = `__outputs/${project.slug}${pathname}`;

  console.log(key);

  try {
    const res = await s3.send(
      new GetObjectCommand({
        Bucket: "vercel-lite-clone",
        Key: key,
      }),
    );

    return new Response(res.Body as any, {
      headers: {
        "Content-Type": contentTypeForPath(pathname, res.ContentType),
        "Cache-Control": "public, max-age=31536000",
      },
    });
  } catch (err: any) {
    if (err.name === "NoSuchKey" && !pathname.includes(".")) {
      try {
        const fallback = await s3.send(
          new GetObjectCommand({
            Bucket: "vercel-lite-clone",
            Key: `__outputs/${project.slug}/index.html`,
          }),
        );
        return new Response(fallback.Body as any, {
          headers: {
            "Content-Type": "text/html",
            "Cache-Control": "no-cache",
          },
        });
      } catch (fallbackErr) {
        return c.text("Not found", 404);
      }
    }
    console.error(`Proxy error for ${key}:`, err);
    return c.text("Not found", 404);
  }
});

export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const DELETE = handle(app);

export default app;
