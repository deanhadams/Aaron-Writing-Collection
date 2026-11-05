import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { LoreEditor } from "@/components/lore/lore-editor";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { db } from "@/lib/db";
import { loadEntry, loadLinkTargets } from "@/lib/lore/read";

async function Editor({ params }: { params: PageProps<"/lore/[slug]/edit">["params"] }) {
  await connection();
  const { slug } = await params;
  const [entry, targets] = await Promise.all([loadEntry(db, decodeURIComponent(slug)), loadLinkTargets(db)]);
  if (!entry) notFound();

  const { id, version, title, category, summary, body, coverKey, tags, aliases } = entry;

  return (
    <>
      <Breadcrumbs
        crumbs={[
          { label: "Lore", href: "/lore" },
          { label: title, href: `/lore/${entry.slug}` },
        ]}
      />
      <LoreEditor
        key={id}
        id={id}
        slug={entry.slug}
        version={version}
        draft={{ title, category, summary, body, coverKey, tags, aliases }}
        targets={targets}
      />
    </>
  );
}

export default function LoreEditPage({ params }: PageProps<"/lore/[slug]/edit">) {
  return (
    <Suspense fallback={<PageSkeleton shape="script" />}>
      <Editor params={params} />
    </Suspense>
  );
}
