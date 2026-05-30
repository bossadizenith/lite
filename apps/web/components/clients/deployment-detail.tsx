"use client";

import {
  BuildLogsAccordion,
  DeploymentDetailsCard,
} from "@/components/deployment-details-card";
import { Logs } from "@/components/logs";
import { formatDeploymentDuration } from "@/lib/deployment-utils";
import { QUERY_KEYS } from "@/lib/consts";
import { PROJECTS_QUERY } from "@/lib/queries";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@lite/ui/lib/utils";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Header } from "../header";

type DeploymentDetailProps = {
  projectSlug: string;
  deploymentId: string;
};

const TABS = ["Deployment", "Logs", "Resources", "Source"] as const;

export const DeploymentDetail = ({
  projectSlug,
  deploymentId,
}: DeploymentDetailProps) => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>("Deployment");

  const { mutate: redeploy, isPending: isRedeploying } = useMutation({
    mutationFn: () => PROJECTS_QUERY.redeploy(projectSlug, deploymentId),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.DEPLOYMENTS, projectSlug],
      });
      toast.success("Redeploy started");
      router.push(`/${result.projectSlug}/${result.deploymentId}`);
    },
    onError: () => {
      toast.error("Failed to redeploy");
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: [QUERY_KEYS.DEPLOYMENTS, projectSlug],
    queryFn: () => PROJECTS_QUERY.deployments(projectSlug),
    enabled: Boolean(projectSlug),
    refetchInterval: (query) => {
      const deployments = query.state.data?.deployments ?? [];
      const current = deployments.find((d) => d.id === deploymentId);
      if (
        current &&
        ["queued", "building", "built", "deploying"].includes(current.status)
      ) {
        return 3000;
      }
      return false;
    },
  });

  const deployment = data?.deployments.find((d) => d.id === deploymentId);
  const projectName = data?.project.name ?? projectSlug;
  const duration = deployment
    ? formatDeploymentDuration(deployment.createdAt, deployment.finishedAt)
    : null;

  const handleDeploymentFinished = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: [QUERY_KEYS.DEPLOYMENTS, projectSlug],
    });
  }, [projectSlug, queryClient]);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <div className="border-b border-border/60">
          <div className="container py-6">
            <nav className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Link
                href={`/${projectSlug}`}
                className="hover:text-foreground hover:underline"
              >
                Deployments
              </Link>
              <ChevronRight className="size-3.5 shrink-0" />
              <span className="font-mono text-foreground">{deploymentId}</span>
            </nav>

            <div className="flex flex-wrap items-center gap-6 border-b border-border/60 pb-0">
              {TABS.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "-mb-px border-b-2 px-1 pb-3 text-sm transition-colors",
                    activeTab === tab
                      ? "border-foreground text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="container flex flex-col gap-4 py-6">
          {isLoading || !deployment ? (
            <p className="text-sm text-muted-foreground">
              {isLoading ? "Loading deployment…" : "Deployment not found."}
            </p>
          ) : (
            <>
              {(activeTab === "Deployment" || activeTab === "Source") && (
                <DeploymentDetailsCard
                  projectSlug={projectSlug}
                  projectName={projectName}
                  deployment={deployment}
                  onRedeploy={() => redeploy()}
                  isRedeploying={isRedeploying}
                />
              )}

              {(activeTab === "Deployment" || activeTab === "Logs") && (
                <BuildLogsAccordion
                  duration={duration}
                  status={deployment.status}
                  defaultOpen={activeTab === "Logs"}
                >
                  <Logs
                    projectSlug={projectSlug}
                    deploymentId={deploymentId}
                    onDeploymentFinished={handleDeploymentFinished}
                    embedded
                  />
                </BuildLogsAccordion>
              )}

              {activeTab === "Resources" ? (
                <section className="rounded-lg border border-border/80 bg-card p-6 text-sm text-muted-foreground">
                  Resource details are not available for this deployment yet.
                </section>
              ) : null}
            </>
          )}
        </div>
      </main>
    </div>
  );
};
