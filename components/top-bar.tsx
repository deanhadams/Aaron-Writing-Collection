import Link from "next/link";
import { Suspense } from "react";
import { UserMenu } from "./user-menu";

export function TopBar() {
  return (
    <header className="border-b border-line bg-white">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
        <Link
          href="/"
          className="font-heading text-xl font-semibold tracking-tight text-primary"
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
