import Form from "next/form";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { RememberSearch, SearchIdeas } from "@/components/search/recent-searches";
import { SceneGroup, SideGroups } from "@/components/search/search-results";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { db } from "@/lib/db";
import { SCENE_KIND_LABELS, type SceneKind } from "@/lib/format";
import { composeQuery } from "@/lib/search/client";
import { runSearch, SEARCH_TYPES, type SearchType } from "@/lib/search/run";

const PAGE_SIZE = 20;

type Search = Partial<Record<"q" | "type" | "speaker" | "kind" | "from" | "to" | "sort" | "page", string>>;

const TYPE_LABELS: Record<SearchType, string> = { scenes: "Scenes", episodes: "Episodes", characters: "Characters", lore: "Lore" };

function Filters({ search }: { search: Search }) {
  return (
    <Form action="/search" className="glass search-form">
      <label className="block">
        <span className="sr-only">Search</span>
        <input name="q" type="search" defaultValue={search.q} placeholder="Search scenes, characters, lore…" className="field" />
      </label>

      <div className="search-filters">
        <label>
          <span className="eyebrow text-muted">Type</span>
          <select name="type" defaultValue={search.type ?? ""} className="field">
            <option value="">Everything</option>
            {SEARCH_TYPES.map((type) => (
              <option key={type} value={type}>
                {TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="eyebrow text-muted">Speaker</span>
          <input name="speaker" defaultValue={search.speaker} placeholder="Any" className="field" />
        </label>
        <label>
          <span className="eyebrow text-muted">Scene kind</span>
          <select name="kind" defaultValue={search.kind ?? ""} className="field">
            <option value="">Any</option>
            {(Object.keys(SCENE_KIND_LABELS) as SceneKind[]).map((kind) => (
              <option key={kind} value={kind}>
                {SCENE_KIND_LABELS[kind]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="eyebrow text-muted">From episode</span>
          <input name="from" type="number" min={1} defaultValue={search.from} className="field" />
        </label>
        <label>
          <span className="eyebrow text-muted">To episode</span>
          <input name="to" type="number" min={1} defaultValue={search.to} className="field" />
        </label>
        <label>
          <span className="eyebrow text-muted">Sort</span>
          <select name="sort" defaultValue={search.sort ?? "best"} className="field">
            <option value="best">Best match</option>
            <option value="episode">Episode order</option>
          </select>
        </label>
      </div>

      <button type="submit" className="btn-primary mt-3 text-sm">
        Search
      </button>
    </Form>
  );
}

async function Results({ searchParams }: { searchParams: Promise<Search> }) {
  await connection();
  const search = await searchParams;
  const input = composeQuery(search);
  const page = Math.max(1, Number(search.page) || 1);
  const type = SEARCH_TYPES.includes(search.type as SearchType) ? (search.type as SearchType) : undefined;

  if (!input) {
    return (
      <>
        <Filters search={search} />
        <SearchIdeas />
      </>
    );
  }

  const { scenes, episodes, characters, lore } = await runSearch(db, input, {
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
    sort: search.sort === "episode" ? "episode" : "best",
    type,
  });

  const total = scenes.total + episodes.total + characters.total + lore.total;
  const pageCount = Math.ceil(Math.max(scenes.total, episodes.total, characters.total, lore.total) / PAGE_SIZE);
  const pageHref = (number: number) => {
    const params = new URLSearchParams(Object.entries(search).filter(([, value]) => value) as [string, string][]);
    params.set("page", String(number));
    return `/search?${params}`;
  };

  return (
    <>
      <RememberSearch query={search.q ?? ""} />
      <Filters search={search} />

      <p role="status" className="mt-5 text-sm text-muted">
        {total === 0 ? "No results" : `${total} ${total === 1 ? "result" : "results"}`}
      </p>

      {total === 0 ? (
        <SearchIdeas />
      ) : (
        <div className="search-layout">
          <div className="min-w-0">
            <SceneGroup results={scenes.results} total={scenes.total} />
          </div>
          <div className="grid min-w-0 content-start gap-6">
            <SideGroups episodes={episodes.results} characters={characters.results} lore={lore.results} />
          </div>
        </div>
      )}

      {pageCount > 1 && (
        <nav aria-label="Pages" className="mt-6 flex items-center justify-center gap-5 text-sm">
          {page > 1 && (
            <Link href={pageHref(page - 1)} className="btn-ghost">
              Previous
            </Link>
          )}
          <span className="text-muted">
            Page {page} of {pageCount}
          </span>
          {page < pageCount && (
            <Link href={pageHref(page + 1)} className="btn-ghost">
              Next
            </Link>
          )}
        </nav>
      )}
    </>
  );
}

export default function SearchPage({ searchParams }: PageProps<"/search">) {
  return (
    <>
      <h1 className="text-gradient mb-6 w-fit text-4xl font-bold tracking-tight sm:text-5xl">Search</h1>
      <Suspense fallback={<PageSkeleton shape="timeline" />}>
        <Results searchParams={searchParams as Promise<Search>} />
      </Suspense>
    </>
  );
}
