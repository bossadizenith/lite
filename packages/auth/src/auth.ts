import { db } from "@lite/db";
import schema from "@lite/db/schema";
import { env } from "@lite/env/server";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

export const auth = betterAuth({
  emailAndPassword: {
    enabled: true,
  },
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      ...schema,
    },
  }),

  trustedOrigins: [env.FRONTEND_URL, env.BACKEND_URL],
  appName: "Lite",

  advanced: {
    crossSubDomainCookies: {
      enabled: process.env.NODE_ENV === "production",
      domain: env.URL,
    },
  },
  verification: {
    disableCleanup: true,
  },
});

export type Session = typeof auth.$Infer.Session;
