import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate } from "react-router";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import { Field, Input } from "@/components/ui/Field";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { useAuth } from "@/contexts/AuthContext";
import { ApiError } from "@/services/api/errors";
import { AuthLayout } from "./AuthLayout";

// Mirrors schemas/authSchema.js loginSchema.
const schema = z.object({
  email: z.string().trim().min(1, "Enter your email").pipe(z.email("Enter a valid email address").max(254)),
  password: z.string().min(1, "Enter your password").max(72, "Passwords are at most 72 characters"),
});
type Values = z.infer<typeof schema>;

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, setError, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setFormError(null);
    try {
      await login(email, password);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from && from !== "/login" ? from : "/", { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setFormError("That email and password don't match an account.");
      } else if (err instanceof ApiError && Object.keys(err.fieldErrors).length) {
        for (const [k, msg] of Object.entries(err.fieldErrors)) {
          if (k === "email" || k === "password") setError(k, { message: msg });
        }
      } else {
        setFormError(err instanceof Error ? err.message : "Couldn't sign in.");
      }
    }
  });

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Welcome back to your ledger."
      footer={
        <>
          New to Ledgerline?{" "}
          <Link to="/register" className="font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        {formError && <ErrorNotice>{formError}</ErrorNotice>}
        <Field label="Email" error={formState.errors.email?.message}>
          {(a) => <Input {...a} type="email" autoComplete="email" autoFocus placeholder="you@company.com" {...register("email")} />}
        </Field>
        <Field label="Password" error={formState.errors.password?.message}>
          {(a) => <PasswordInput {...a} autoComplete="current-password" {...register("password")} />}
        </Field>
        {/* TODO: Not implemented yet - no password reset endpoint in the backend, so there is no "Forgot password" link. */}
        <Button type="submit" variant="primary" size="lg" loading={formState.isSubmitting} className="mt-1 w-full">
          {formState.isSubmitting ? "Signing in" : "Sign in"}
        </Button>
      </form>
    </AuthLayout>
  );
}
