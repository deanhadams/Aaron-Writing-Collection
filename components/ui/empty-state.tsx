import type { ReactNode } from "react";
import { BunnyIllustration } from "./bunny-illustration";

export function EmptyState({
  mood = "empty",
  title,
  children,
}: {
  mood?: "empty" | "lost" | "error";
  title: string;
  children?: ReactNode;
}) {
  return (
    <section className="glass rise mx-auto max-w-md p-8 text-center">
      <BunnyIllustration mood={mood} />
      <h2 className="mt-4 text-2xl font-semibold">{title}</h2>
      <div className="mt-2 text-muted">{children}</div>
    </section>
  );
}
