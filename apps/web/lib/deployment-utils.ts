import type { DeploymentSummary } from "./types";

export type DeploymentStatusFilter =
  | "all"
  | "ready"
  | "error"
  | "building";

const IN_PROGRESS = ["queued", "building", "built", "deploying"];

export function deploymentStatusLabel(status: string) {
  switch (status) {
    case "healthy":
      return "Ready";
    case "failed":
      return "Error";
    case "deploying":
      return "Deploying";
    case "building":
    case "built":
      return "Building";
    case "queued":
      return "Queued";
    default:
      return status;
  }
}

export function deploymentStatusDotClass(status: string) {
  switch (status) {
    case "healthy":
      return "bg-emerald-500";
    case "failed":
      return "bg-red-500";
    case "deploying":
      return "bg-amber-500";
    default:
      return "bg-zinc-400";
  }
}

export function formatDeploymentDuration(
  createdAt: string,
  finishedAt: string | null,
) {
  if (!finishedAt) return null;
  const ms =
    new Date(finishedAt).getTime() - new Date(createdAt).getTime();
  if (ms < 1000) return "<1s";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export function formatRelativeTime(value: string) {
  const date = new Date(value);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function shortCommitHash(hash: string | null) {
  if (!hash) return null;
  return hash.slice(0, 7);
}

export function deploymentTitle(deployment: DeploymentSummary) {
  if (deployment.redeployOfId) {
    return `Redeploy of ${deployment.redeployOfId}`;
  }
  if (deployment.commitMessage) {
    return deployment.commitMessage;
  }
  return `Deployment ${deployment.id}`;
}

export function filterDeployments(
  deployments: DeploymentSummary[],
  statusFilter: DeploymentStatusFilter,
) {
  if (statusFilter === "all") return deployments;
  if (statusFilter === "ready") {
    return deployments.filter((d) => d.status === "healthy");
  }
  if (statusFilter === "error") {
    return deployments.filter((d) => d.status === "failed");
  }
  return deployments.filter((d) => IN_PROGRESS.includes(d.status));
}

export function authorInitials(name: string | null | undefined) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}
