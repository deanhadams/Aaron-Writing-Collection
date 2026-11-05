import Link from "next/link";
import { getCurrentSession } from "@/lib/auth/current-session";
import { Suspense } from "react";
import { LogoMark } from "./layout/logo-mark";
import { NavLinks } from "./layout/nav-links";
import { SearchPalette } from "./search/search-palette";
import { UserMenu } from "./user-menu";

/** Only for someone signed in: the login page has nothing to search. */
async function SignedInSearch() {
  return (await getCurrentSession()) ? <SearchPalette /> : null;
}

export function TopBar() {
  return (
    <header className="topbar">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:gap-6 sm:px-6">
        <Link href="/" aria-label="Aaron's Writing Collection" className="hidden shrink-0 items-center gap-2 min-[380px]:flex">
          <LogoMark className="size-8 shrink-0 sm:size-9" />
          <span className="hidden truncate font-heading text-lg font-semibold tracking-tight lg:inline">
            Aaron&apos;s Writing Collection
          </span>
        </Link>
        <NavLinks />
        <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-4">
          <Suspense>
            <SignedInSearch />
          </Suspense>
          <Suspense>
            <UserMenu />
          </Suspense>
        </div>
      </div>
    </header>
  );
}
