"use client";

import { RegisterSchema, registerSchema } from "@/lib/schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { authClient } from "@lite/auth/auth-client";
import { Field, FieldError, FieldGroup } from "@lite/ui/components/field";
import { Input } from "@lite/ui/components/input";
import { LoadingButton } from "@lite/ui/components/loading-button";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

export const RegisterForm = () => {
  const form = useForm<RegisterSchema>({
    resolver: zodResolver(registerSchema),
  });

  const { mutate: register, isPending } = useMutation({
    mutationFn: async (values: RegisterSchema) => {
      const { data, error } = await authClient.signUp.email({
        name: values.name,
        email: values.email,
        password: values.password,
        fetchOptions: {},
      });

      if (error) throw new Error(error.message);

      return data;
    },
    onSuccess: (data) => {
      toast.success(`Welcome, ${data.user.name}!`);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleRegister = (data: RegisterSchema) => register(data);

  return (
    <div className="flex flex-col max-w-lg w-full gap-8">
      <h2 className="text-2xl font-bold">Register</h2>
      <form
        onSubmit={form.handleSubmit(handleRegister)}
        className="w-full space-y-4"
      >
        <FieldGroup>
          <Controller
            name="name"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <Input
                  {...field}
                  id="name"
                  aria-invalid={fieldState.invalid}
                  placeholder="Name"
                  autoComplete="off"
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
        </FieldGroup>
        <FieldGroup>
          <Controller
            name="email"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <Input
                  {...field}
                  id="email"
                  aria-invalid={fieldState.invalid}
                  placeholder="Email"
                  autoComplete="off"
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
        </FieldGroup>
        <FieldGroup>
          <Controller
            name="password"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <Input
                  {...field}
                  id="password"
                  aria-invalid={fieldState.invalid}
                  placeholder="Password"
                  autoComplete="off"
                  type="password"
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
          Register
        </LoadingButton>
        <p className="text-sm text-muted-foreground text-center">
          Already have an account?{" "}
          <Link
            href="/auth/login"
            className="text-sm font-medium text-muted-foreground hover:text-foreground hover:underline"
          >
            Login
          </Link>
        </p>
      </form>
    </div>
  );
};
