import Link from "next/link";
import { Suspense } from "react";
import { LogoMark } from "./layout/logo-mark";
import { NavLinks } from "./layout/nav-links";
import { UserMenu } from "./user-menu";

export function TopBar() {
  return (
    <header className="topbar">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="flex min-w-0 items-center gap-2">
          <LogoMark className="size-9 shrink-0" />
          <span className="truncate font-heading text-base font-semibold tracking-tight sm:text-lg">
            Aaron&apos;s Writing Collection
          </span>
        </Link>
        <NavLinks />
        <div className="ml-auto shrink-0">
          <Suspense>
            <UserMenu />
          </Suspense>
        </div>
      </div>
    </header>
  );
}
