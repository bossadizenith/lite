"use client";

import { LoginSchema, loginSchema } from "@/lib/schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { authClient } from "@lite/auth/auth-client";
import { Field, FieldError, FieldGroup } from "@lite/ui/components/field";
import { Input } from "@lite/ui/components/input";
import { LoadingButton } from "@lite/ui/components/loading-button";
import { useMutation } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { Checkbox } from "@lite/ui/components/checkbox";
import { Label } from "@lite/ui/components/label";
import Link from "next/link";

export const LoginForm = () => {
  const form = useForm<LoginSchema>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      rememberMe: false,
    },
  });

  const { mutate: login, isPending } = useMutation({
    mutationFn: async (values: LoginSchema) => {
      const { data, error } = await authClient.signIn.email({
        email: values.email,
        password: values.password,
        rememberMe: values.rememberMe,
        fetchOptions: {},
        callbackURL: "/",
      });

      if (error) throw new Error(error.message);

      return data;
    },
    onSuccess: (data) => {
      toast.success(`Welcome back, ${data.user.name}!`);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleLogin = (data: LoginSchema) => login(data);

  return (
    <div className="flex flex-col max-w-lg w-full gap-8">
      <h2 className="text-2xl font-bold">Login</h2>
      <form
        onSubmit={form.handleSubmit(handleLogin)}
        className="w-full space-y-4"
      >
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Controller
              name="rememberMe"
              control={form.control}
              render={({ field }) => (
                <Checkbox
                  id="rememberMe"
                  name={field.name}
                  checked={field.value ?? false}
                  onCheckedChange={field.onChange}
                  onBlur={field.onBlur}
                  ref={field.ref}
                />
              )}
            />
            <Label htmlFor="rememberMe">Remember me</Label>
          </div>
          <Link
            href="/auth/forgot-password"
            className="text-sm text-muted-foreground hover:text-foreground hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <LoadingButton
          loading={isPending}
          disabled={isPending}
          type="submit"
          className="w-full"
        >
          Login
        </LoadingButton>
        <p className="text-sm text-muted-foreground text-center">
          Don't have an account?{" "}
          <Link
            href="/auth/register"
            className="text-sm font-medium text-muted-foreground hover:text-foreground hover:underline"
          >
            Register
          </Link>
        </p>
      </form>
    </div>
  );
};
