"use client";

import { projectPreviewUrl } from "@/components/deployment-preview";
import {
  authorInitials,
  deploymentStatusDotClass,
  deploymentStatusLabel,
  deploymentTitle,
  formatDeploymentDuration,
  formatRelativeTime,
  shortCommitHash,
} from "@/lib/deployment-utils";
import type { DeploymentSummary } from "@/lib/types";
import { useSession } from "@/providers/session";
import { Avatar, AvatarFallback, AvatarImage } from "@lite/ui/components/avatar";
import { Button } from "@lite/ui/components/button";
import { cn } from "@lite/ui/lib/utils";
import {
  Check,
  ChevronDown,
  ExternalLink,
  GitBranch,
  GitCommit,
  Globe,
  Link2,
  MoreHorizontal,
  Timer,
} from "lucide-react";
type DeploymentDetailsCardProps = {
  projectSlug: string;
  projectName: string;
  deployment: DeploymentSummary;
};

function MetaField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[100px_1fr] gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export const DeploymentDetailsCard = ({
  projectSlug,
  projectName,
  deployment,
}: DeploymentDetailsCardProps) => {
  const { user } = useSession();
  const previewUrl = projectPreviewUrl(projectSlug);
  const productionUrl = deployment.url.startsWith("http")
    ? deployment.url
    : `https://${deployment.url}`;
  const canPreview = deployment.status === "healthy";
  const duration = formatDeploymentDuration(
    deployment.createdAt,
    deployment.finishedAt,
  );
  const hash = shortCommitHash(deployment.commitHash);
  const branch = deployment.branch || "main";
  const displayAuthor = deployment.commitAuthor || user?.name;
  const initials = authorInitials(displayAuthor);
  const commitLabel = deploymentTitle(deployment);

  return (
    <section className="overflow-hidden rounded-lg border border-border/80 bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 px-5 py-4">
        <h2 className="text-lg font-semibold">Deployment Details</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 bg-transparent font-normal"
          >
            Share
          </Button>
          <a
            href={previewUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-transparent px-3 text-sm font-normal hover:bg-muted/50"
          >
            Visit
            <ChevronDown className="size-3.5 opacity-60" />
          </a>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground"
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="border-b border-border/80 p-5 lg:border-b-0 lg:border-r">
          <div
            className={cn(
              "overflow-hidden rounded-md border bg-white shadow-sm",
              canPreview ? "aspect-[16/10] min-h-[280px]" : "min-h-[200px]",
            )}
          >
            {canPreview ? (
              <iframe
                title={`${projectName} preview`}
                src={previewUrl}
                className="size-full border-0"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              />
            ) : (
              <div className="flex size-full min-h-[200px] items-center justify-center bg-zinc-100 p-8 text-center text-sm text-zinc-500">
                Preview will appear when the deployment is ready.
                <br />
                <span className="mt-1 capitalize text-zinc-400">
                  Status: {deploymentStatusLabel(deployment.status)}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-5 p-5">
          <MetaField label="Created">
            <div className="flex items-center gap-2">
              <Avatar size="sm">
                {user?.image ? (
                  <AvatarImage src={user.image} alt="" />
                ) : null}
                <AvatarFallback className="text-[10px]">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span>
                {displayAuthor ?? "Unknown"}{" "}
                <span className="text-muted-foreground">
                  {formatRelativeTime(deployment.createdAt)}
                </span>
              </span>
            </div>
          </MetaField>

          <MetaField label="Status">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "size-2.5 rounded-full",
                  deploymentStatusDotClass(deployment.status),
                )}
              />
              <span className="font-medium">
                {deploymentStatusLabel(deployment.status)}
              </span>
              {deployment.isCurrent ? (
                <span className="rounded border border-border px-1.5 py-0.5 text-xs text-muted-foreground">
                  Latest
                </span>
              ) : null}
            </div>
          </MetaField>

          <MetaField label="Duration">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Timer className="size-4 shrink-0" />
              <span>{duration ?? "—"}</span>
            </div>
          </MetaField>

          <MetaField label="Environment">
            <div className="flex flex-wrap items-center gap-2">
              <Globe className="size-4 shrink-0 text-muted-foreground" />
              <span>Production</span>
              {deployment.isCurrent ? (
                <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-xs font-medium text-blue-400">
                  Current
                </span>
              ) : null}
            </div>
          </MetaField>

          <MetaField label="Domains">
            <ul className="space-y-1.5">
              <li>
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-foreground hover:underline"
                >
                  <Link2 className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate font-mono text-xs">
                    {previewUrl.replace(/^https?:\/\//, "")}
                  </span>
                  <ExternalLink className="size-3 shrink-0 opacity-50" />
                </a>
              </li>
              {productionUrl !== previewUrl ? (
                <li>
                  <a
                    href={productionUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground hover:underline"
                  >
                    <span className="truncate font-mono text-xs">
                      {deployment.url}
                    </span>
                    <ExternalLink className="size-3 shrink-0 opacity-50" />
                  </a>
                </li>
              ) : null}
            </ul>
          </MetaField>

          <MetaField label="Source">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <GitBranch className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="font-mono text-xs">{branch}</span>
              </div>
              <div className="flex items-start gap-2">
                <GitCommit className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="font-mono text-xs text-foreground">
                    {hash ?? deployment.id}
                  </p>
                  <p className="line-clamp-2 text-muted-foreground">
                    {commitLabel}
                  </p>
                </div>
              </div>
            </div>
          </MetaField>
        </div>
      </div>
    </section>
  );
};

type BuildLogsAccordionProps = {
  duration: string | null;
  status: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
};

export function BuildLogsAccordion({
  duration,
  status,
  defaultOpen = true,
  children,
}: BuildLogsAccordionProps) {
  const isComplete = status === "healthy" || status === "failed";

  return (
    <details
      className="group overflow-hidden rounded-lg border border-border/80 bg-card"
      open={defaultOpen}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
        <div className="flex items-center gap-3">
          <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
          <span className="font-medium">Build Logs</span>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          {duration ? <span>{duration}</span> : null}
          {isComplete ? (
            <span className="flex size-6 items-center justify-center rounded-full bg-blue-500/20 text-blue-400">
              <Check className="size-3.5" />
            </span>
          ) : (
            <span className="size-2.5 animate-pulse rounded-full bg-amber-500" />
          )}
        </div>
      </summary>
      <div className="border-t border-border/80">{children}</div>
    </details>
  );
}
