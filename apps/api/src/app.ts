import { db } from "@lite/db";
import { env } from "@lite/env/server.js";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { handle } from "hono/vercel";
import { routes } from "./routes/index.js";
import type { ReqVariables } from "./utils/hono.js";
import "./utils/load-env.js";

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
  c.set("db", db);
  await next();
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
