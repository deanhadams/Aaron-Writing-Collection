import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = { title: "Sign in" };

type SearchParams = PageProps<"/login">["searchParams"];

async function LoginFormWithNext({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { next } = await searchParams;
  return <LoginForm next={typeof next === "string" ? next : undefined} />;
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <section className="mx-auto mt-10 max-w-sm rounded-2xl border border-line bg-white p-8">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <Suspense fallback={<LoginForm />}>
        <LoginFormWithNext searchParams={searchParams} />
      </Suspense>
    </section>
  );
}
