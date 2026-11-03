import Link from "next/link";
import type { ReactNode } from "react";

export function ListRow({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <li>
      <Link href={href} className="card card-link flex items-center gap-4 px-5 py-4">
        {children}
      </Link>
    </li>
  );
}
