import { Hono } from "hono";
import type { ReqVariables } from "../utils/hono.js";
import { authRouter } from "./auth/index.js";
import projectsRouter from "./projects/index.js";

const routes = new Hono<{ Variables: ReqVariables }>();

routes.route("/projects", projectsRouter);
routes.route("/auth", authRouter);

export { routes };
