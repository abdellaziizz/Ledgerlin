import { zodResolver } from "@hookform/resolvers/zod";
import { Check } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import { Field, Input } from "@/components/ui/Field";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { useAuth } from "@/contexts/AuthContext";
import { ApiError } from "@/services/api/errors";
import { cn } from "@/utils/cn";
import { AuthLayout } from "./AuthLayout";

// Mirrors schemas/authSchema.js registerSchema (bcrypt ignores bytes past 72, hence the cap).
const schema = z
  .object({
    email: z.string().trim().min(1, "Enter your email").pipe(z.email("Enter a valid email address").max(254)),
    password: z.string().min(8, "Use at least 8 characters").max(72, "Use at most 72 characters"),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords don't match" });
type Values = z.infer<typeof schema>;

export default function RegisterPage() {
  const { register: signUp } = useAuth();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, setError, watch, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "", confirm: "" },
  });
  const password = watch("password");
  const longEnough = password.length >= 8;

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setFormError(null);
    try {
      await signUp(email, password);
      navigate("/", { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError("email", { message: "An account with this email already exists." });
      } else if (err instanceof ApiError && Object.keys(err.fieldErrors).length) {
        for (const [k, msg] of Object.entries(err.fieldErrors)) {
          if (k === "email" || k === "password") setError(k, { message: msg });
        }
      } else {
        setFormError(err instanceof Error ? err.message : "Couldn't create your account.");
      }
    }
  });

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Open wallets and move money between them."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        {formError && <ErrorNotice>{formError}</ErrorNotice>}
        <Field label="Email" error={formState.errors.email?.message}>
          {(a) => <Input {...a} type="email" autoComplete="email" autoFocus placeholder="you@company.com" {...register("email")} />}
        </Field>
        <Field
          label="Password"
          error={formState.errors.password?.message}
          hint={
            <span className={cn("inline-flex items-center gap-1.5 transition-colors", longEnough && "text-credit")}>
              <Check className={cn("size-3.5", !longEnough && "opacity-40")} aria-hidden />
              8 to 72 characters
            </span>
          }
        >
          {(a) => <PasswordInput {...a} autoComplete="new-password" {...register("password")} />}
        </Field>
        <Field label="Confirm password" error={formState.errors.confirm?.message}>
          {(a) => <PasswordInput {...a} autoComplete="new-password" {...register("confirm")} />}
        </Field>
        <Button type="submit" variant="primary" size="lg" loading={formState.isSubmitting} className="mt-1 w-full">
          {formState.isSubmitting ? "Creating account" : "Create account"}
        </Button>
      </form>
    </AuthLayout>
  );
}
