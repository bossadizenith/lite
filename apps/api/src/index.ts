import { Hono } from "hono";

const app = new Hono();

app.get("/", (c) => {
  return c.text("Hello World from lite api");
});

export default app;
