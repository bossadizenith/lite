"use client";

import { DeploymentPreview } from "@/components/deployment-preview";
import { DeploymentHistory } from "@/components/deployment-history";
import { Logs } from "@/components/logs";
import { QUERY_KEYS } from "@/lib/consts";
import { PROJECTS_QUERY } from "@/lib/queries";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useCallback } from "react";
import { Header } from "../header";

type DeploymentDetailProps = {
  projectSlug: string;
  deploymentId: string;
};

export const DeploymentDetail = ({
  projectSlug,
  deploymentId,
}: DeploymentDetailProps) => {
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: [QUERY_KEYS.DEPLOYMENTS, projectSlug],
    queryFn: () => PROJECTS_QUERY.deployments(projectSlug),
    enabled: Boolean(projectSlug),
  });

  const deployment = data?.deployments.find((d) => d.id === deploymentId);
  const projectName = data?.project.name ?? projectSlug;

  const handleDeploymentFinished = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: [QUERY_KEYS.DEPLOYMENTS, projectSlug],
    });
  }, [projectSlug, queryClient]);

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1 container py-10 flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <Link
            href={`/${projectSlug}`}
            className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            {projectName}
          </Link>
          <h1 className="text-2xl font-bold">Deployment</h1>
          <p className="text-sm text-muted-foreground font-mono">
            {deploymentId}
          </p>
        </div>

        <div className="flex w-full min-w-0 flex-col gap-6">
          <DeploymentHistory
            projectSlug={projectSlug}
            selectedDeploymentId={deploymentId}
            linkToDeployment
            compact
            showFilters={false}
          />

          <DeploymentPreview
            projectSlug={projectSlug}
            status={deployment?.status}
          />

          <Logs
            projectSlug={projectSlug}
            deploymentId={deploymentId}
            onDeploymentFinished={handleDeploymentFinished}
          />
        </div>
      </main>
    </div>
  );
};
