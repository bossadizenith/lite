import "./utils/load-env.js";
import { handle } from "hono/vercel";
import { Hono } from "hono";

const app = new Hono();

app.get("/", (c) => {
  return c.text("Hello World from lite api");
});

export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const DELETE = handle(app);

export default app;
