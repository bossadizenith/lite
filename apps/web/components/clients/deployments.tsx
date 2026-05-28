"use client";

import { DeploymentHistory } from "../deployment-history";
import { Header } from "../header";

export const Deployments = ({ projectSlug }: { projectSlug: string }) => {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1 container py-10 flex flex-col gap-10">
        <DeploymentHistory
          projectSlug={projectSlug}
          onSelectDeployment={() => {}}
        />
      </main>
    </div>
  );
};
