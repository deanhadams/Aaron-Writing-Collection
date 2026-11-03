import type { Metadata } from "next";
import { Suspense } from "react";
import { LogoMark } from "@/components/layout/logo-mark";
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
    <section className="glass rise mx-auto mt-8 max-w-sm p-8">
      <LogoMark className="mx-auto size-16" />
      <h1 className="text-gradient mx-auto mt-3 w-fit text-3xl font-bold tracking-tight">
        Welcome back
      </h1>
      <Suspense fallback={<LoginForm />}>
        <LoginFormWithNext searchParams={searchParams} />
      </Suspense>
    </section>
  );
}
