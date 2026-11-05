import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { LoreCover } from "@/components/lore/lore-cover";
import { LoreMarkdown } from "@/components/lore/lore-markdown";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { db } from "@/lib/db";
import { formatRelative, sceneTitle } from "@/lib/format";
import { imageUrl } from "@/lib/images";
import { headingsIn } from "@/lib/lore/links";
import { loadEntry, loadLinkLookup, loadMentions, loadRelated } from "@/lib/lore/read";

const CONTENTS_FROM = 3;

async function Entry({ params }: { params: PageProps<"/lore/[slug]">["params"] }) {
  await connection();
  const { slug } = await params;
  const entry = await loadEntry(db, decodeURIComponent(slug));
  if (!entry) notFound();

  const [lookup, mentions, related] = await Promise.all([
    loadLinkLookup(db),
    loadMentions(db, [entry.title, ...entry.aliases]),
    loadRelated(db, entry),
  ]);
  const headings = headingsIn(entry.body);

  return (
    <>
      <Breadcrumbs crumbs={[{ label: "Lore", href: "/lore" }]} />

      <header className="lore-hero rise">
        <LoreCover category={entry.category} url={imageUrl(entry.coverKey, entry.updatedAt.getTime())} className="lore-hero-cover" />
        <div className="lore-hero-text">
          <p className="eyebrow">{entry.category}</p>
          <h1 className="font-heading text-4xl font-bold tracking-tight sm:text-5xl">{entry.title}</h1>
          {entry.summary && <p className="mt-2 text-lg">{entry.summary}</p>}
        </div>
      </header>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Link href={`/lore/${entry.slug}/edit`} className="btn-primary text-sm">
          Edit
        </Link>
        {entry.tags.map((tag) => (
          <span key={tag} className="char-chip char-chip-quiet">
            {tag}
          </span>
        ))}
        {entry.editor && (
          <span className="ml-auto text-xs text-muted">
            Last edited by {entry.editor} · {formatRelative(entry.updatedAt, new Date())}
          </span>
        )}
      </div>

      <div className="lore-columns">
        <article className="glass min-w-0 p-6">
          <LoreMarkdown body={entry.body} lookup={lookup} />
        </article>

        <aside className="grid min-w-0 content-start gap-5">
          {headings.length >= CONTENTS_FROM && (
            <nav aria-label="On this page" className="glass p-5">
              <h2 className="text-lg font-semibold">On this page</h2>
              <ol className="mt-2 grid gap-1 text-sm">
                {headings.map(({ id, text, level }) => (
                  <li key={id} data-level={level} className="lore-toc-item">
                    <a href={`#${id}`} className="text-primary-strong hover:underline">
                      {text}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          )}

          <section aria-labelledby="mentioned-in" className="glass p-5">
            <h2 id="mentioned-in" className="text-lg font-semibold">
              Mentioned in
            </h2>
            {mentions.length === 0 ? (
              <p className="mt-1 text-sm text-muted">No scene says this name yet.</p>
            ) : (
              <ul className="mt-2 grid gap-1 text-sm">
                {mentions.map((scene) => (
                  <li key={scene.id}>
                    <Link href={`/scenes/${scene.id}`} className="text-primary-strong hover:underline">
                      Episode {scene.episodeNumber}: {sceneTitle(scene)}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="related" className="glass p-5">
            <h2 id="related" className="text-lg font-semibold">
              Related
            </h2>
            {related.length === 0 ? (
              <p className="mt-1 text-sm text-muted">No linked entries yet. Link one with [[its title]].</p>
            ) : (
              <ul className="mt-2 grid gap-1 text-sm">
                {related.map((item) => (
                  <li key={item.slug}>
                    <Link href={`/lore/${item.slug}`} className="text-primary-strong hover:underline">
                      {item.title}
                    </Link>
                    <span className="text-xs text-muted"> {item.isLinkedFromHere ? "linked from here" : "links here"}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}

export default function LoreEntryPage({ params }: PageProps<"/lore/[slug]">) {
  return (
    <Suspense fallback={<PageSkeleton shape="profile" />}>
      <Entry params={params} />
    </Suspense>
  );
}
