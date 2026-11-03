import Link from "next/link";
import { Suspense } from "react";
import { UserMenu } from "./user-menu";

export function TopBar() {
  return (
    <header className="border-b-2 border-b-transparent bg-white [border-image:linear-gradient(90deg,var(--color-primary),var(--color-neon))_1]">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-6">
        <Link
          href="/"
          className="font-heading text-lg font-semibold sm:text-xl tracking-tight text-primary"
        >
          Aaron&apos;s Writing Collection
        </Link>
        <Suspense>
          <UserMenu />
        </Suspense>
      </div>
    </header>
  );
}
