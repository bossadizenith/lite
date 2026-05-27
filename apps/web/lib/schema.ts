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

export const registerSchema = z.object({
  name: z.string(),
  email: z.email(),
  password: z.string(),
});

export const loginSchema = z.object({
  email: z.email(),
  password: z.string(),
});

export type CreateProjectSchema = z.infer<typeof createProjectSchema>;
export type RegisterSchema = z.infer<typeof registerSchema>;
export type LoginSchema = z.infer<typeof loginSchema>;
