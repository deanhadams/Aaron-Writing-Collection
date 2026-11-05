"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useLayoutEffect, useRef } from "react";
import { LOGIN_PATH } from "@/lib/auth/protection";

const NAV_ITEMS = [
  {
    href: "/",
    label: "Library",
    isActive: (path: string) =>
      path === "/" || /^\/(seasons|episodes|scenes)\//.test(path),
  },
  {
    href: "/characters",
    label: "Characters",
    isActive: (path: string) => path === "/characters" || path.startsWith("/characters/"),
  },
  {
    href: "/lore",
    label: "Lore",
    isActive: (path: string) => path === "/lore" || path.startsWith("/lore/"),
  },
];

function NavList({ pathname }: { pathname?: string }) {
  return NAV_ITEMS.map(({ href, label, isActive }) => (
    <Link
      key={href}
      href={href}
      aria-current={pathname && isActive(pathname) ? "page" : undefined}
      className="flex h-full items-center px-1 text-sm font-medium text-muted transition-colors hover:text-primary-strong aria-[current=page]:text-primary-strong"
    >
      {label}
    </Link>
  ));
}

function ActiveNav() {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);

  // Written straight to the element: the indicator slides on transform alone,
  // so moving it never re-renders or reflows the bar.
  useLayoutEffect(() => {
    function place() {
      const indicator = indicatorRef.current;
      const active = navRef.current?.querySelector<HTMLElement>(
        '[aria-current="page"]',
      );
      if (!indicator) return;

      indicator.style.opacity = active ? "1" : "0";
      if (active) {
        const { offsetLeft: x, offsetWidth: width } = active;
        indicator.style.transform = `translateX(${x}px) scaleX(${width})`;
      }
    }

    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [pathname]);

  if (pathname === LOGIN_PATH) return null;

  return (
    <nav ref={navRef} aria-label="Main" className="relative flex h-full gap-3 sm:gap-6">
      <NavList pathname={pathname} />
      <span ref={indicatorRef} aria-hidden className="nav-indicator" />
    </nav>
  );
}

export function NavLinks() {
  return (
    <Suspense
      fallback={
        <nav aria-label="Main" className="flex h-full gap-3 sm:gap-6">
          <NavList />
        </nav>
      }
    >
      <ActiveNav />
    </Suspense>
  );
}
