import Link from "next/link";
import { Fragment } from "react";

type Crumb = { label: string; href: string };

export function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap gap-2 text-sm">
      {crumbs.map((crumb, index) => (
        <Fragment key={crumb.href}>
          {index > 0 && <span aria-hidden className="text-muted">/</span>}
          <Link href={crumb.href} className="btn-ghost !p-0">
            {crumb.label}
          </Link>
        </Fragment>
      ))}
    </nav>
  );
}
