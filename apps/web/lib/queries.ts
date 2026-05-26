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

export type DeploymentSummary = {
  id: string;
  status: string;
  type: string;
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
  errorMessage: string | null;
  isCurrent: boolean;
};

export type ProjectDeploymentsResponse = {
  project: {
    id: string;
    slug: string;
    name: string;
    currentDeploymentId: string | null;
  };
  deployments: DeploymentSummary[];
};

export const PROJECTS_QUERY = {
  create: async (data: CreateProjectSchema) => {
    const response = await apiClient.post<{
      id: string;
      slug: string;
      name: string;
      repoUrl: string;
      deploymentId: string;
    }>("/projects", data);
    return response;
  },
  deployments: async (slug: string) => {
    return apiClient.get<ProjectDeploymentsResponse>(
      `/projects/${slug}/deployments`,
    );
  },
  logs: async (deploymentId: string) => {
    return apiClient.get<{
      logs: LogEvent[];
      deployment: DeploymentMetadata;
    }>(`/projects/${deploymentId}/logs`);
  },
};
