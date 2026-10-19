"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button, Field, Input } from "@/components/ui";
import type { AuthState } from "./actions";

export function AuthForm({
  mode,
  action,
  next,
  notice,
}: {
  mode: "login" | "signup";
  action: (s: AuthState, f: FormData) => Promise<AuthState>;
  next?: string;
  notice?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-linear-to-br from-brand-400 to-brand-700 text-lg font-extrabold text-white shadow-brand">
            L
          </div>
          <h1 className="text-xl font-semibold">
            {mode === "login" ? "Sign in to Locatify Guides" : "Create your account"}
          </h1>
        </div>
        {notice && !state?.error && (
          <p className="mb-4 rounded-md bg-amber-50 px-4 py-2.5 text-sm text-amber-800 ring-1 ring-amber-200" role="status">
            {notice}
          </p>
        )}
        <form action={formAction} className="space-y-4 rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
          {mode === "signup" && (
            <Field label="Name">
              <Input name="name" autoComplete="name" required />
            </Field>
          )}
          <Field label="Email">
            <Input name="email" type="email" autoComplete="email" required />
          </Field>
          <Field label="Password">
            <Input
              name="password"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              minLength={mode === "signup" ? 8 : undefined}
              required
            />
          </Field>
          {next && <input type="hidden" name="next" value={next} />}
          {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
          <Button className="w-full" disabled={pending}>
            {pending ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-500">
          {mode === "login" ? (
            <>
              No account?{" "}
              <Link className="font-semibold text-brand-600" href="/signup">
                Sign up
              </Link>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <Link className="font-semibold text-brand-600" href="/login">
                Sign in
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
