"use client";

import { DeploymentHistory } from "@/components/deployment-history";
import { Logs } from "@/components/logs";
import { QUERY_KEYS } from "@/lib/consts";
import { PROJECTS_QUERY } from "@/lib/queries";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { parseAsString, useQueryState } from "nuqs";
import { useCallback } from "react";
import { Header } from "../header";

type DeploymentsProps = {
  projectSlug: string;
};

export const Deployments = ({ projectSlug }: DeploymentsProps) => {
  const queryClient = useQueryClient();
  const [selectedDeploymentId, setSelectedDeploymentId] = useQueryState(
    "deployment",
    parseAsString.withOptions({ clearOnDefault: true, history: "replace" }),
  );

  const { data } = useQuery({
    queryKey: [QUERY_KEYS.DEPLOYMENTS, projectSlug],
    queryFn: () => PROJECTS_QUERY.deployments(projectSlug),
    enabled: Boolean(projectSlug),
  });

  const handleDeploymentFinished = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: [QUERY_KEYS.DEPLOYMENTS, projectSlug],
    });
  }, [projectSlug, queryClient]);

  const projectName = data?.project.name ?? projectSlug;

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1 container py-10 flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <Link
            href="/"
            className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Projects
          </Link>
          <h1 className="text-2xl font-bold">{projectName}</h1>
          <p className="text-sm text-muted-foreground font-mono">{projectSlug}</p>
        </div>

        <div className="flex w-full min-w-0 flex-col gap-6">
          <DeploymentHistory
            projectSlug={projectSlug}
            selectedDeploymentId={selectedDeploymentId ?? undefined}
            onSelectDeployment={(deploymentId) => {
              void setSelectedDeploymentId(deploymentId);
            }}
          />

          {selectedDeploymentId ? (
            <Logs
              projectSlug={projectSlug}
              deploymentId={selectedDeploymentId}
              onDeploymentFinished={handleDeploymentFinished}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Select a deployment to view build logs.
            </p>
          )}
        </div>
      </main>
    </div>
  );
};
