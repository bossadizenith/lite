import { DeploymentDetail } from "@/components/clients/deployment-detail";

const Page = async ({
  params,
}: {
  params: Promise<{ slug: string; deploymentId: string }>;
}) => {
  const { slug, deploymentId } = await params;
  return (
    <DeploymentDetail projectSlug={slug} deploymentId={deploymentId} />
  );
};

export default Page;
