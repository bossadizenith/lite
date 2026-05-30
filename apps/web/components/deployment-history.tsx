"use client";

import { QUERY_KEYS } from "@/lib/consts";
import {
  authorInitials,
  deploymentStatusDotClass,
  deploymentStatusLabel,
  deploymentTitle,
  filterDeployments,
  formatDeploymentDuration,
  formatRelativeTime,
  shortCommitHash,
  type DeploymentStatusFilter,
} from "@/lib/deployment-utils";
import { PROJECTS_QUERY } from "@/lib/queries";
import type { DeploymentHistoryProps, DeploymentSummary } from "@/lib/types";
import { useSession } from "@/providers/session";
import { Avatar, AvatarFallback, AvatarImage } from "@lite/ui/components/avatar";
import { Button } from "@lite/ui/components/button";
import { cn } from "@lite/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronDown,
  GitBranch,
  GitCommit,
  MoreHorizontal,
  RotateCw,
  Search,
} from "lucide-react";
import Link from "next/link";
import React from "react";

function DeploymentRow({
  deployment,
  projectSlug,
  isSelected,
  linkToDeployment,
  onSelectDeployment,
  authorName,
  authorImage,
}: {
  deployment: DeploymentSummary;
  projectSlug: string;
  isSelected: boolean;
  linkToDeployment: boolean;
  onSelectDeployment?: (deploymentId: string) => void;
  authorName?: string | null;
  authorImage?: string | null;
}) {
  const href = `/${projectSlug}/${deployment.id}`;
  const title = deploymentTitle(deployment);
  const duration = formatDeploymentDuration(
    deployment.createdAt,
    deployment.finishedAt,
  );
  const hash = shortCommitHash(deployment.commitHash);
  const branch = deployment.branch || "main";
  const displayAuthor = deployment.commitAuthor || authorName;
  const initials = authorInitials(displayAuthor);

  const rowContent = (
    <>
      <div className="min-w-0 flex-1 py-4 pl-4">
        <p className="truncate text-sm font-medium">{title}</p>
      </div>

      <div className="flex w-[140px] shrink-0 items-center gap-2 py-4">
        <span
          className={cn(
            "size-2.5 shrink-0 rounded-full",
            deploymentStatusDotClass(deployment.status),
          )}
        />
        <div className="min-w-0">
          <p className="text-sm">{deploymentStatusLabel(deployment.status)}</p>
          {duration ? (
            <p className="text-xs text-muted-foreground">{duration}</p>
          ) : null}
        </div>
      </div>

      <div className="flex w-[120px] shrink-0 items-center py-4">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
            deployment.isCurrent
              ? "border-foreground/20 bg-foreground/5"
              : "border-border text-muted-foreground",
          )}
        >
          {deployment.isCurrent ? (
            <span className="size-3.5 rounded-full border border-current" />
          ) : null}
          Production
        </span>
      </div>

      <div className="flex w-[180px] shrink-0 items-center gap-1.5 py-4 text-sm text-muted-foreground">
        {deployment.redeployOfId ? (
          <>
            <RotateCw className="size-3.5 shrink-0" />
            <span className="truncate">
              Redeploy of {deployment.redeployOfId}
            </span>
          </>
        ) : (
          <>
            <GitCommit className="size-3.5 shrink-0" />
            <span className="font-mono text-xs">{hash ?? deployment.id}</span>
          </>
        )}
      </div>

      <div className="flex w-[100px] shrink-0 items-center gap-1.5 py-4 text-sm text-muted-foreground">
        <GitBranch className="size-3.5 shrink-0" />
        <span className="truncate">{branch}</span>
      </div>

      <div className="flex w-[100px] shrink-0 items-center py-4 text-sm text-muted-foreground">
        {formatRelativeTime(deployment.createdAt)}
      </div>

      <div className="flex w-12 shrink-0 items-center justify-center py-4">
        <Avatar size="sm">
          {authorImage ? <AvatarImage src={authorImage} alt="" /> : null}
          <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
        </Avatar>
      </div>

      <div className="flex w-12 shrink-0 items-center justify-center py-4 pr-2">
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground"
          onClick={(event) => event.preventDefault()}
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </div>
    </>
  );

  const rowClass = cn(
    "group flex min-w-[900px] border-b border-border/60 transition-colors hover:bg-muted/30",
    { "bg-muted/40": isSelected },
  );

  if (linkToDeployment) {
    return (
      <Link href={href} className={rowClass}>
        {rowContent}
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={cn(rowClass, "w-full text-left")}
      onClick={() => onSelectDeployment?.(deployment.id)}
    >
      {rowContent}
    </button>
  );
}

export const DeploymentHistory = ({
  projectSlug,
  selectedDeploymentId,
  onSelectDeployment,
  linkToDeployment = false,
  showFilters = true,
  compact = false,
}: DeploymentHistoryProps) => {
  const { user } = useSession();
  const [statusFilter, setStatusFilter] =
    React.useState<DeploymentStatusFilter>("all");

  const { data, isLoading, isError } = useQuery({
    queryKey: [QUERY_KEYS.DEPLOYMENTS, projectSlug],
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
  const filtered = filterDeployments(deployments, statusFilter);
  const latestDeploymentId = deployments[0]?.id;
  const didAutoSelect = React.useRef(false);

  React.useEffect(() => {
    didAutoSelect.current = false;
  }, [projectSlug]);

  React.useEffect(() => {
    if (
      linkToDeployment ||
      selectedDeploymentId ||
      !latestDeploymentId ||
      didAutoSelect.current ||
      !onSelectDeployment
    ) {
      return;
    }
    didAutoSelect.current = true;
    onSelectDeployment(latestDeploymentId);
  }, [
    latestDeploymentId,
    linkToDeployment,
    onSelectDeployment,
    selectedDeploymentId,
  ]);

  const statusCounts = {
    all: deployments.length,
    ready: deployments.filter((d) => d.status === "healthy").length,
    error: deployments.filter((d) => d.status === "failed").length,
    building: deployments.filter((d) =>
      ["queued", "building", "built", "deploying"].includes(d.status),
    ).length,
  };

  return (
    <div className="w-full min-w-0">
      {showFilters && !compact ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-4 py-3">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 bg-transparent text-muted-foreground font-normal"
          >
            <Search className="size-3.5" />
            All Branches…
            <ChevronDown className="size-3.5 opacity-60" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 bg-transparent text-muted-foreground font-normal"
          >
            All Authors…
            <ChevronDown className="size-3.5 opacity-60" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 bg-transparent text-muted-foreground font-normal"
          >
            All Environments
            <ChevronDown className="size-3.5 ml-1 opacity-60" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 bg-transparent text-muted-foreground font-normal"
          >
            Select Date Range
          </Button>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-8 bg-transparent font-normal",
              statusFilter !== "all"
                ? "border-foreground/30 text-foreground"
                : "text-muted-foreground",
            )}
            onClick={() =>
              setStatusFilter((current) =>
                current === "all"
                  ? "ready"
                  : current === "ready"
                    ? "error"
                    : current === "error"
                      ? "building"
                      : "all",
              )
            }
          >
            Status {statusCounts.ready + statusCounts.error}/
            {statusCounts.all || "—"}
            <ChevronDown className="size-3.5 ml-1 opacity-60" />
          </Button>
        </div>
      ) : null}

      {isLoading ? (
        <p className="px-4 py-8 text-sm text-muted-foreground">
          Loading deployments…
        </p>
      ) : null}

      {isError ? (
        <p className="px-4 py-8 text-sm text-red-400">
          Failed to load deployments.
        </p>
      ) : null}

      {!isLoading && !isError && filtered.length === 0 ? (
        <p className="px-4 py-8 text-sm text-muted-foreground">
          {deployments.length === 0
            ? "No deployments yet."
            : "No deployments match this filter."}
        </p>
      ) : null}

      {!isLoading && !isError && filtered.length > 0 ? (
        <div className="overflow-x-auto">
          <div className="min-w-[900px]">
            {filtered.map((deployment) => (
              <DeploymentRow
                key={deployment.id}
                deployment={deployment}
                projectSlug={projectSlug}
                isSelected={deployment.id === selectedDeploymentId}
                linkToDeployment={linkToDeployment}
                onSelectDeployment={onSelectDeployment}
                authorName={user?.name}
                authorImage={user?.image}
              />
            ))}
          </div>
        </div>
      ) : null}

      {!isLoading && !isError && deployments.length > 10 ? (
        <div className="flex justify-center border-t border-border/60 py-6">
          <Button variant="outline" size="sm" className="bg-transparent">
            Load More
          </Button>
        </div>
      ) : null}
    </div>
  );
};
