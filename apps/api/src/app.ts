import { db } from "@lite/db";
import { Hono } from "hono";
import { handle } from "hono/vercel";
import { routes } from "./routes/index.js";
import type { ReqVariables } from "./utils/hono.js";
import "./utils/load-env.js";

const app = new Hono<{ Variables: ReqVariables }>();

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
