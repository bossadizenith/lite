import "./utils/load-env.js";
import { db } from "@lite/db";
import { env } from "@lite/env/server.js";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { handle } from "hono/vercel";
import { routes } from "./routes/index.js";
import type { ReqVariables } from "./utils/hono.js";
import { auth } from "@lite/auth/auth";
import { startDeploymentSyncWorker } from "./services/deployment-sync-worker.js";

startDeploymentSyncWorker();

const app = new Hono<{ Variables: ReqVariables }>();

app.use(
  "*",
  cors({
    origin: (origin, c) => {
      if (env.TRUSTED_ORIGINS.includes("*")) return origin;
      return env.TRUSTED_ORIGINS.includes(origin) ? origin : null;
    },
    credentials: true,
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "Origin",
    ],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    exposeHeaders: ["Set-Cookie"],
    maxAge: 86400,
  }),
);

app.use("*", async (c, next) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session) {
    c.set("session", null);
    return next();
  }

  c.set("session", session);
  c.set("db", db);
  return next();
});

app.route("/api", routes);

app.get("/", (c) => {
  return c.text("Hello World from lite api");
});

export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const DELETE = handle(app);

export default app;
