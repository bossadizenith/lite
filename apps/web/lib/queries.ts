import { apiClient } from "./api-client";
import { CreateProjectSchema } from "./schema";
import type {
  DeploymentMetadata,
  LogEvent,
  ProjectDeploymentsResponse,
  ProjectsListParams,
  ProjectsListResponse,
} from "./types";

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
  redeploy: async (slug: string, deploymentId: string) => {
    return apiClient.post<{
      deploymentId: string;
      projectSlug: string;
      redeployOfId: string;
    }>(`/projects/${slug}/deployments/${deploymentId}/redeploy`);
  },
  logs: async (deploymentId: string) => {
    return apiClient.get<{
      logs: LogEvent[];
      deployment: DeploymentMetadata;
    }>(`/projects/${deploymentId}/logs`);
  },
  list: async (params: ProjectsListParams = {}) => {
    return apiClient.get<ProjectsListResponse>("/projects", {
      params: {
        page: params.page ?? 1,
        limit: params.limit ?? 12,
        q: params.q?.trim() || undefined,
      },
    });
  },
};
