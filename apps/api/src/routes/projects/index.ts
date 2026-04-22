import { projects } from "@lite/db/schema";
import { Hono } from "hono";
import type { ReqVariables } from "../../utils/hono.js";

const projectsRouter = new Hono<{ Variables: ReqVariables }>();

projectsRouter.get("/", async (c) => {
  const db = c.get("db");
  const allProjects = await db.select().from(projects);
  return c.json(allProjects);
});

export default projectsRouter;
