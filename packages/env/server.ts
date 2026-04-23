import { createEnv as createEnvCore } from "@t3-oss/env-core";
import { z } from "zod";
import BASE_ENV from "./base.js";

export const env = createEnvCore({
  ...BASE_ENV,
  runtimeEnv: process.env,
  server: {
    DATABASE_URL: z.url(),
    BACKEND_URL: z.string(),
    FRONTEND_URL: z.string(),
    AWS_ACCESS_KEY_ID: z.string(),
    AWS_SECRET_ACCESS_KEY: z.string(),
    AWS_REGION: z.string(),
    // REDIS_URL: z.string(),
    ECS_CLUSTER_ARN: z.string(),
    ECS_TASK_DEFINITION_ARN: z.string(),
    SUBNET_1: z.string(),
    SUBNET_2: z.string(),
    SUBNET_3: z.string(),
    SECURITY_GROUP: z.string(),
    TRUSTED_ORIGINS: z
      .string()
      .transform((val) => val.trim())
      .refine(
        (val) => {
          if (val === "*") return true;
          const origins = val.split(",").map((s) => s.trim());
          return origins.every((origin) => {
            try {
              z.url().parse(origin);
              return true;
            } catch {
              return false;
            }
          });
        },
        {
          message: 'Must be "*" or a comma-separated list of valid URLs',
        },
      )
      .transform((val) => {
        if (val === "*") return ["*"];
        return val.split(",").map((s) => s.trim());
      }),

    UPSTASH_REDIS_REST_URL: z.string().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  },
});

export type ENV = typeof env;
