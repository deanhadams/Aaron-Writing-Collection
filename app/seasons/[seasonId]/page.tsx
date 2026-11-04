import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ReadLinks } from "@/components/reader/reader-page";
import { SeasonBoard } from "@/components/structure/season-board";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { seasonTitle } from "@/lib/format";
import { getSeason } from "@/lib/queries/library";

type Params = PageProps<"/seasons/[seasonId]">["params"];

async function Season({ params }: { params: Params }) {
  const { seasonId } = await params;
  const season = await getSeason(seasonId);
  if (!season) notFound();

  const now = new Date();

  return (
    <>
      <Breadcrumbs crumbs={[{ label: "Library", href: "/" }]} />
      <p className="eyebrow text-primary-strong">{season.seriesTitle}</p>
      <h1 className="text-gradient w-fit text-4xl font-bold tracking-tight sm:text-5xl">
        {seasonTitle(season)}
      </h1>
      {season.summary && <p className="mt-3 max-w-2xl whitespace-pre-wrap text-lg text-muted">{season.summary}</p>}

      <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2">
        <ReadLinks seasonId={season.id} firstHref={`/read/${season.id}`} className="contents" />
        <a href={`/api/export/seasons/${season.id}`} className="btn-ghost text-sm">
          Download Word
        </a>
      </div>

      <div className="mt-6">
        <SeasonBoard season={season} now={now} />
      </div>
    </>
  );
}

export default function SeasonPage({ params }: PageProps<"/seasons/[seasonId]">) {
  return (
    <Suspense fallback={<PageSkeleton shape="cards" />}>
      <Season params={params} />
    </Suspense>
  );
}
