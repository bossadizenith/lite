import { env } from "@lite/env/client.js";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: env.NEXT_PUBLIC_BACKEND_URL,
});
