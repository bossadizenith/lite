import { Deployments } from "@/components/clients/deployments";

const Page = async ({ params }: { params: Promise<{ slug: string }> }) => {
  const { slug } = await params;
  return <Deployments projectSlug={slug} />;
};

export default Page;
