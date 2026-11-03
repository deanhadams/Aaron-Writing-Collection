import Link from "next/link";
import { Fragment } from "react";

type Crumb = { label: string; href: string };

export function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap gap-2 text-sm">
      {crumbs.map((crumb, index) => (
        <Fragment key={crumb.href}>
          {index > 0 && <span className="text-ink/30">/</span>}
          <Link href={crumb.href} className="text-primary hover:underline">
            {crumb.label}
          </Link>
        </Fragment>
      ))}
    </nav>
  );
}
