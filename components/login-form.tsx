"use client";

import { useActionState } from "react";
import { login } from "@/lib/auth/actions";

const fieldClass =
  "mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 focus:border-primary";

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
          className={fieldClass}
        />
      </label>

      <label className="block text-sm font-medium">
        Password
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={fieldClass}
        />
      </label>

      {state.error && (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-primary px-4 py-2 font-medium text-white transition-shadow hover:shadow-neon disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
