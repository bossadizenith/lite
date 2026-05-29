"use client";

import { PROJECTS_QUERY } from "@/lib/queries";
import type { DeploymentHistoryProps, DeploymentSummary } from "@/lib/types";
import { cn } from "@lite/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import React from "react";

const statusStyles: Record<string, string> = {
  queued: "bg-zinc-500/20 text-zinc-300",
  building: "bg-blue-500/20 text-blue-300",
  built: "bg-indigo-500/20 text-indigo-300",
  deploying: "bg-amber-500/20 text-amber-200",
  healthy: "bg-emerald-500/20 text-emerald-300",
  failed: "bg-red-500/20 text-red-300",
};

function formatWhen(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded px-2 py-0.5 text-xs font-medium capitalize",
        statusStyles[status] ?? "bg-zinc-500/20 text-zinc-300",
      )}
    >
      {status}
    </span>
  );
}

export const DeploymentHistory = ({
  projectSlug,
  selectedDeploymentId,
  onSelectDeployment,
}: DeploymentHistoryProps) => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["deployments", projectSlug],
    queryFn: () => PROJECTS_QUERY.deployments(projectSlug),
    enabled: Boolean(projectSlug),
    refetchInterval: (query) => {
      const deployments = query.state.data?.deployments ?? [];
      const hasInProgress = deployments.some((d) =>
        ["queued", "building", "built", "deploying"].includes(d.status),
      );
      return hasInProgress ? 3000 : false;
    },
  });

  const deployments = data?.deployments ?? [];
  const latestDeploymentId = deployments[0]?.id;
  const didAutoSelect = React.useRef(false);

  React.useEffect(() => {
    didAutoSelect.current = false;
  }, [projectSlug]);

  React.useEffect(() => {
    if (selectedDeploymentId || !latestDeploymentId || didAutoSelect.current) {
      return;
    }
    didAutoSelect.current = true;
    onSelectDeployment(latestDeploymentId);
  }, [latestDeploymentId, selectedDeploymentId, onSelectDeployment]);

  return (
    <div className="w-full min-w-0 overflow-hidden rounded-md border">
      <div className="flex items-center justify-between border-b p-4">
        <h2 className="text-lg font-semibold">Deployments</h2>
        <span className="text-sm text-muted-foreground">
          {data?.project.name ?? projectSlug}
        </span>
      </div>

      {isLoading ? (
        <p className="p-4 text-sm text-muted-foreground">
          Loading deployments…
        </p>
      ) : null}

      {isError ? (
        <p className="p-4 text-sm text-red-400">Failed to load deployments.</p>
      ) : null}

      {!isLoading && !isError && deployments.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">No deployments yet.</p>
      ) : null}

      {!isLoading && !isError && deployments.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="px-4 py-2 font-medium">Deployment</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Created</th>
                <th className="px-4 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {deployments.map((deployment: DeploymentSummary) => {
                const isSelected = deployment.id === selectedDeploymentId;

                return (
                  <tr
                    key={deployment.id}
                    className={cn("border-b border-border/50", {
                      "bg-muted/40": isSelected,
                    })}
                  >
                    <td className="px-4 py-2 font-mono text-xs">
                      {deployment.id}
                      {deployment.isCurrent ? (
                        <span className="ml-2 rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-medium uppercase text-emerald-300">
                          Live
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-2">
                      <StatusBadge status={deployment.status} />
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {formatWhen(deployment.createdAt)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => onSelectDeployment(deployment.id)}
                        className={cn(
                          "text-sm font-medium underline-offset-4 hover:underline",
                          isSelected
                            ? "text-foreground"
                            : "text-muted-foreground",
                        )}
                      >
                        View logs
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
};
