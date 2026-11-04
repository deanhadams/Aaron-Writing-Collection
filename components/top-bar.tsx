import Link from "next/link";
import { Suspense } from "react";
import { LogoMark } from "./layout/logo-mark";
import { NavLinks } from "./layout/nav-links";
import { UserMenu } from "./user-menu";

export function TopBar() {
  return (
    <header className="topbar">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:gap-6 sm:px-6">
        <Link href="/" aria-label="Aaron's Writing Collection" className="flex shrink-0 items-center gap-2">
          <LogoMark className="size-8 shrink-0 sm:size-9" />
          <span className="hidden truncate font-heading text-lg font-semibold tracking-tight lg:inline">
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
