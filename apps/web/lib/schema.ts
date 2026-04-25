import { z } from "zod";

export const createProjectSchema = z.object({
  repoUrl: z.url(),
});

export type CreateProjectSchema = z.infer<typeof createProjectSchema>;
