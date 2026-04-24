import "./utils/load-env.js";

import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { db } from "@lite/db";
import { projects } from "@lite/db/schema.js";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { handle } from "hono/vercel";
import { env } from "@lite/env/server.js";

const app = new Hono();

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
        "Content-Type": res.ContentType || "text/html",
        "Cache-Control": "public, max-age=31536000",
      },
    });
  } catch (err: any) {
    if (err.name === "NoSuchKey" && !pathname.includes(".")) {
      try {
        const fallback = await s3.send(
          new GetObjectCommand({
            Bucket: "vercel-lite-clone",
            Key: `__outputs/${project.id}/index.html`,
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
