"use client";

import { Logs } from "@/components/logs";
import { PROJECTS_QUERY } from "@/lib/queries";
import { CreateProjectSchema, createProjectSchema } from "@/lib/schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { Field, FieldError, FieldGroup } from "@lite/ui/components/field";
import { Input } from "@lite/ui/components/input";
import { LoadingButton } from "@lite/ui/components/loading-button";
import { useMutation } from "@tanstack/react-query";
import React from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

export const Create = () => {
  const [deploymentId, setDeploymentId] = React.useState<string | null>(null);
  const form = useForm<CreateProjectSchema>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: {
      repoUrl: "https://github.com/bossadizenith/test-repo",
    },
  });
  const { mutate: createProject, isPending } = useMutation({
    mutationFn: PROJECTS_QUERY.create,
    onSuccess: (project) => {
      setDeploymentId(project.slug);
      toast.success("Project created successfully");
    },
    onError: () => {
      toast.error("Failed to create project");
    },
  });

  const handleCreateProject = (data: CreateProjectSchema) => {
    createProject(data);
  };

  return (
    <div className="flex flex-col gap-8 items-center justify-center h-screen">
      <form
        onSubmit={form.handleSubmit(handleCreateProject)}
        className="w-full max-w-md space-y-4"
      >
        <div className="flex gap-2 items-center">
          <FieldGroup>
            <Controller
              name="repoUrl"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  {/* <FieldLabel htmlFor="form-rhf-demo-title">
                  Repository URL
                </FieldLabel> */}
                  <Input
                    {...field}
                    id="form-rhf-demo-title"
                    aria-invalid={fieldState.invalid}
                    placeholder="https://github.com/vercel/next.js"
                    autoComplete="off"
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
          </FieldGroup>

          <LoadingButton
            loading={isPending}
            disabled={isPending}
            type="submit"
            className="w-fit"
          >
            Create
          </LoadingButton>
        </div>

        <Envs />
      </form>
      {deploymentId ? (
        <div className="w-full max-w-3xl">
          <Logs deploymentId={deploymentId} />
        </div>
      ) : null}
    </div>
  );
};

const Envs = () => {
  return (
    <div className="space-y-2">
      <h1 className="text-sm">Environment Variables</h1>
      <div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-2">
            <input type="text" placeholder="key" />
            <input type="text" placeholder="value" />
          </div>
        ))}
      </div>
    </div>
  );
};
