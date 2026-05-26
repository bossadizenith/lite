"use client";

import { DeploymentHistory } from "@/components/deployment-history";
import { Logs } from "@/components/logs";
import { PROJECTS_QUERY } from "@/lib/queries";
import { CreateProjectSchema, createProjectSchema } from "@/lib/schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { Field, FieldError, FieldGroup } from "@lite/ui/components/field";
import { Input } from "@lite/ui/components/input";
import { LoadingButton } from "@lite/ui/components/loading-button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import React from "react";
import {
  Controller,
  useForm,
  useFieldArray,
  Control,
  UseFormRegister,
} from "react-hook-form";
import { toast } from "sonner";

export const Create = () => {
  const [projectSlug, setProjectSlug] = React.useState<string | null>(null);
  const [selectedDeploymentId, setSelectedDeploymentId] = React.useState<
    string | undefined
  >();
  const queryClient = useQueryClient();
  const form = useForm<CreateProjectSchema>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: {
      repoUrl: "https://github.com/bossadizenith/test-repo",
    },
  });
  const { mutate: createProject, isPending } = useMutation({
    mutationFn: PROJECTS_QUERY.create,
    onSuccess: (project) => {
      setProjectSlug(project.slug);
      setSelectedDeploymentId(project.deploymentId);
      void queryClient.invalidateQueries({
        queryKey: ["deployments", project.slug],
      });
      toast.success("Project created successfully");
    },
    onError: () => {
      toast.error("Failed to create project");
    },
  });

  const handleCreateProject = (data: CreateProjectSchema) => {
    createProject(data);
  };

  const handleDeploymentFinished = React.useCallback(() => {
    if (!projectSlug) return;
    void queryClient.invalidateQueries({
      queryKey: ["deployments", projectSlug],
    });
  }, [projectSlug, queryClient]);

  return (
    <div className="flex flex-col gap-8 items-center justify-center min-h-screen py-20">
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
            Deploy
          </LoadingButton>
        </div>

        <Envs control={form.control} register={form.register} />
      </form>
      {projectSlug ? (
        <div className="flex w-full max-w-3xl min-w-0 flex-col gap-4">
          <DeploymentHistory
            projectSlug={projectSlug}
            selectedDeploymentId={selectedDeploymentId}
            onSelectDeployment={setSelectedDeploymentId}
          />
          {selectedDeploymentId ? (
            <Logs
              projectSlug={projectSlug}
              deploymentId={selectedDeploymentId}
              onDeploymentFinished={handleDeploymentFinished}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

const Envs = ({
  control,
  register,
}: {
  control: Control<CreateProjectSchema>;
  register: UseFormRegister<CreateProjectSchema>;
}) => {
  const { fields, append, update, remove } = useFieldArray({
    control,
    name: "envVars",
  });

  React.useEffect(() => {
    if (fields.length === 0) {
      append({ key: "", value: "" });
    }
  }, [fields.length, append]);

  const handlePaste = (
    e: React.ClipboardEvent<HTMLInputElement>,
    index: number,
  ) => {
    const pastedText = e.clipboardData.getData("text/plain");
    if (!pastedText.includes("=")) return;

    e.preventDefault();
    const lines = pastedText
      .split(/\r?\n/)
      .filter((line) => line.trim() && line.includes("="));

    if (lines.length > 0) {
      const parsed = lines.map((line) => {
        const firstEquals = line.indexOf("=");
        const key = line.substring(0, firstEquals).trim();
        let value = line.substring(firstEquals + 1).trim();

        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.substring(1, value.length - 1);
        }

        return { key, value };
      });

      update(index, parsed[0]!);

      if (parsed.length > 1) {
        append(parsed.slice(1));
      }
    }
  };

  return (
    <div className="space-y-2">
      <h1 className="text-sm">Environment Variables</h1>
      <div className="space-y-2">
        {fields.map((field, index) => {
          const keyReg = register(`envVars.${index}.key`);
          const valReg = register(`envVars.${index}.value`);
          return (
            <div key={field.id} className="flex gap-2 items-center group">
              <Input
                {...keyReg}
                placeholder="Key"
                onPaste={(e) => handlePaste(e, index)}
                onChange={(e) => {
                  keyReg.onChange(e);
                  if (index === fields.length - 1 && e.target.value) {
                    append({ key: "", value: "" });
                  }
                }}
              />
              <Input
                {...valReg}
                placeholder="Value"
                onPaste={(e) => handlePaste(e, index)}
                onChange={(e) => {
                  valReg.onChange(e);
                  if (index === fields.length - 1 && e.target.value) {
                    append({ key: "", value: "" });
                  }
                }}
              />
              {fields.length > 1 && index < fields.length - 1 && (
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-2"
                >
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 15 15"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M11.7816 4.03157C12.0062 3.80702 12.0062 3.44295 11.7816 3.2184C11.5571 2.99385 11.193 2.99385 10.9685 3.2184L7.50005 6.68682L4.03164 3.2184C3.80708 2.99385 3.44301 2.99385 3.21846 3.2184C2.99391 3.44295 2.99391 3.80702 3.21846 4.03157L6.68688 7.49999L3.21846 10.9684C2.99391 11.193 2.99391 11.557 3.21846 11.7816C3.44301 12.0061 3.80708 12.0061 4.03164 11.7816L7.50005 8.31316L10.9685 11.7816C11.193 12.0061 11.5571 12.0061 11.7816 11.7816C12.0062 11.557 12.0062 11.193 11.7816 10.9684L8.31322 7.49999L11.7816 4.03157Z"
                      fill="currentColor"
                      fillRule="evenodd"
                      clipRule="evenodd"
                    ></path>
                  </svg>
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
