"use client";

import { PROJECTS_QUERY } from "@/lib/queries";
import { Logs } from "@/components/logs";
import { Input } from "@lite/ui/components/input";
import { LoadingButton } from "@lite/ui/components/loading-button";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { CreateProjectSchema, createProjectSchema } from "@/lib/schema";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import React from "react";
import {
  FieldGroup,
  Field,
  FieldLabel,
  FieldError,
} from "@lite/ui/components/field";

export const Create = () => {
  const [deploymentId, setDeploymentId] = React.useState<string | null>(null);
  const form = useForm<CreateProjectSchema>({
    resolver: zodResolver(createProjectSchema),
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
        <FieldGroup>
          <Controller
            name="repoUrl"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="form-rhf-demo-title">
                  Repository URL
                </FieldLabel>
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
          className="w-full"
        >
          Create
        </LoadingButton>
      </form>
      {deploymentId ? (
        <div className="w-full max-w-3xl">
          <Logs deploymentId={deploymentId} />
        </div>
      ) : null}
    </div>
  );
};
