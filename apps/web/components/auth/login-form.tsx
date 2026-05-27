import { LoginSchema, loginSchema } from "@/lib/schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { authClient } from "@lite/auth/auth-client";
import { Field, FieldError, FieldGroup } from "@lite/ui/components/field";
import { Input } from "@lite/ui/components/input";
import { LoadingButton } from "@lite/ui/components/loading-button";
import { useMutation } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

export const LoginForm = () => {
  const form = useForm<LoginSchema>({
    resolver: zodResolver(loginSchema),
  });

  const { mutate: login, isPending } = useMutation({
    mutationFn: (data: LoginSchema) => authClient.signIn.email({ ...data }),
    onSuccess: () => {
      toast.success("Login successful");
    },
    onError: (error) => {
      toast.error("Login failed");
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
          Login
        </LoadingButton>
      </form>
    </div>
  );
};
