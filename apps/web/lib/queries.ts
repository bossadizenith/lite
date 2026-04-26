import { apiClient } from "./api-client";
import { CreateProjectSchema } from "./schema";

export type LogEvent = {
  id: string;
  timestamp: number;
  level: "info" | "error" | "success" | "warn";
  message: string;
  source?: "build" | "system";
};

export type DeploymentMetadata = Record<string, string>;

export const PROJECTS_QUERY = {
  create: async (data: CreateProjectSchema) => {
    const response = await apiClient.post<{
      id: string;
      slug: string;
      name: string;
      repoUrl: string;
    }>("/projects", data);
    return response;
  },
  logs: async (deploymentId: string) => {
    return apiClient.get<{
      logs: LogEvent[];
      deployment: DeploymentMetadata;
    }>(`/projects/${deploymentId}/logs`);
  },
};
