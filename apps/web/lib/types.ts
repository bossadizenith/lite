import { Projects } from "@lite/db/types";

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

export type ProjectsListParams = {
  page?: number;
  limit?: number;
  q?: string;
};

export type ProjectsListResponse = {
  projects: Projects[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
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

export type DeploymentHistoryProps = {
  projectSlug: string;
  selectedDeploymentId?: string;
  onSelectDeployment: (deploymentId: string) => void;
};
