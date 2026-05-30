"use client";

type DeploymentPreviewProps = {
  projectSlug: string;
  status?: string;
};

const isDev = process.env.NODE_ENV === "development";

export function projectPreviewUrl(projectSlug: string) {
  return isDev
    ? `http://${projectSlug}.localhost:8000`
    : `https://${projectSlug}.localhoststories.dev`;
}

export const DeploymentPreview = ({
  projectSlug,
  status,
}: DeploymentPreviewProps) => {
  const previewUrl = projectPreviewUrl(projectSlug);
  const canPreview = status === "healthy";

  return (
    <div className="w-full overflow-hidden rounded-md border">
      <div className="flex items-center justify-between border-b p-4">
        <h2 className="text-lg font-semibold">Preview</h2>
        <a
          href={previewUrl}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          Open in new tab
        </a>
      </div>
      {canPreview ? (
        <iframe
          title={`${projectSlug} deployment preview`}
          src={previewUrl}
          className="h-[320px] w-full border-0 bg-white"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      ) : (
        <p className="p-6 text-sm text-muted-foreground">
          Preview is available once the deployment is healthy.
          {status ? ` Current status: ${status}.` : ""}
        </p>
      )}
    </div>
  );
};
