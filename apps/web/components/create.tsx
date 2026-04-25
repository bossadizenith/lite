"use client";

import { PROJECTS_QUERY } from "@/lib/queries";
import { LoadingButton } from "@lite/ui/components/loading-button";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

export const Create = () => {
  const { mutate: createProject, isPending } = useMutation({
    mutationFn: PROJECTS_QUERY.create,
    onSuccess: () => {
      toast.success("Project created successfully");
    },
    onError: () => {
      toast.error("Failed to create project");
    },
  });

  const handleCreateProject = (repoUrl: string) => {
    createProject(repoUrl);
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <div>
        <LoadingButton
          loading={isPending}
          disabled={isPending}
          onClick={() =>
            handleCreateProject("https://github.com/vercel/next.js")
          }
        >
          Create
        </LoadingButton>
      </div>
    </div>
  );
};
