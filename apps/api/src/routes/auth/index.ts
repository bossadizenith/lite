import { auth } from "@lite/auth/auth";
import type { ReqVariables } from "../../utils/hono.js";
import { Hono, type Context } from "hono";

const authRouter = new Hono<{ Variables: ReqVariables }>();

authRouter.on(["POST", "GET"], "/*", async (c: Context) => {
  try {
    return await auth.handler(c.req.raw);
  } catch (error) {
    console.error("Auth handler error:", error);
    return c.json({ error: "Authentication failed" }, 500);
  }
});

export { authRouter };
