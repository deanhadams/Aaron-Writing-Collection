"use client";

import { useActionState } from "react";
import { login } from "@/lib/auth/actions";

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(login, { error: null });

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <input type="hidden" name="next" value={next ?? "/"} />

      <label className="block text-sm font-medium">
        Email
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          className="field"
        />
      </label>

      <label className="block text-sm font-medium">
        Password
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="field"
        />
      </label>

      {state.error && (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
