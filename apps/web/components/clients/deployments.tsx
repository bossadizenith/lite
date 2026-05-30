"use client";

import { DeploymentHistory } from "@/components/deployment-history";
import { QUERY_KEYS } from "@/lib/consts";
import { PROJECTS_QUERY } from "@/lib/queries";
import { Button } from "@lite/ui/components/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Flame, Rocket } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Header } from "../header";

type DeploymentsProps = {
  projectSlug: string;
};

export const Deployments = ({ projectSlug }: DeploymentsProps) => {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: [QUERY_KEYS.DEPLOYMENTS, projectSlug],
    queryFn: () => PROJECTS_QUERY.deployments(projectSlug),
    enabled: Boolean(projectSlug),
  });

  const { mutate: redeploy, isPending: isRedeploying } = useMutation({
    mutationFn: () => PROJECTS_QUERY.redeploy(projectSlug),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.DEPLOYMENTS, projectSlug],
      });
      toast.success("Deployment started");
      router.push(`/${result.projectSlug}/${result.deploymentId}`);
    },
    onError: () => {
      toast.error("Failed to start deployment");
    },
  });

  const projectName = data?.project.name ?? projectSlug;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <div className="border-b border-border/60">
          <div className="container flex items-center justify-between gap-4 py-6">
            <div className="flex min-w-0 items-center gap-6">
              <Link
                href="/"
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
              >
                <Flame className="size-4 shrink-0" />
                <span className="truncate font-medium text-foreground">
                  {projectName}
                </span>
                <ChevronDown className="size-4 shrink-0 opacity-60" />
              </Link>
              <h1 className="text-lg font-semibold">Deployments</h1>
            </div>
            <Button
              onClick={() => redeploy()}
              disabled={isRedeploying}
              size="sm"
              variant="outline"
              className="shrink-0"
            >
              <Rocket className="size-4" />
              Redeploy
            </Button>
          </div>
        </div>

        <div className="container py-0">
          <DeploymentHistory projectSlug={projectSlug} linkToDeployment />
        </div>
      </main>
    </div>
  );
};
