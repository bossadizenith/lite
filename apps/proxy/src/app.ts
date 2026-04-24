import { db } from "@lite/db";
import { projects } from "@lite/db/schema.js";
import { env } from "@lite/env/server.js";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { handle } from "hono/vercel";
import "./utils/load-env.js";

const app = new Hono();

const BASE_PATH = env.AWS_BUCKET_URL;

app.all("*", async (c) => {
  const host = c.req.header("host") || "";
  const hostname = host.split(":")[0];
  const url = new URL(c.req.url);

  // 1. Try finding by custom domain
  let project = await db.query.projects.findFirst({
    where: eq(projects.customDomain, hostname),
  });

  // 2. Try finding by subdomain if not found
  if (!project) {
    const subdomain = hostname.split(".")[0];
    project = await db.query.projects.findFirst({
      where: eq(projects.subDomain, subdomain),
    });
  }

  if (!project) {
    return c.text("Project not found", 404);
  }

  let pathname = url.pathname;
  if (pathname === "/") {
    pathname = "/index.html";
  }

  const target = `${BASE_PATH}${project.id}${pathname}`;

  try {
    const res = await fetch(target);

    if (!res.ok) throw new Error("Not found");

    return new Response(res.body, {
      headers: {
        "Content-Type": res.headers.get("content-type") || "text/html",
        "Cache-Control": "public, max-age=31536000",
      },
    });
  } catch (err) {
    const fallback = await fetch(`${BASE_PATH}${project.id}/index.html`);

    return new Response(fallback.body, {
      headers: {
        "Content-Type": "text/html",
      },
    });
  }
});

export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const DELETE = handle(app);

export default app;
