import { z } from "zod";

export const createProjectSchema = z.object({
  repoUrl: z.url(),
  envVars: z
    .array(
      z.object({
        key: z.string(),
        value: z.string(),
      }),
    )
    .optional(),
});

export type CreateProjectSchema = z.infer<typeof createProjectSchema>;
