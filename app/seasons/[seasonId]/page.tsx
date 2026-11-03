import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EpisodeCard } from "@/components/library/episode-card";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { EmptyState } from "@/components/ui/empty-state";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { seasonTitle } from "@/lib/format";
import { getSeason } from "@/lib/queries/library";

type Params = PageProps<"/seasons/[seasonId]">["params"];

async function Season({ params }: { params: Params }) {
  const { seasonId } = await params;
  const season = await getSeason(seasonId);
  if (!season) notFound();

  return (
    <>
      <Breadcrumbs crumbs={[{ label: "Library", href: "/" }]} />
      <p className="eyebrow text-primary-strong">{season.seriesTitle}</p>
      <h1 className="text-gradient mb-8 w-fit text-4xl font-bold tracking-tight sm:text-5xl">
        {seasonTitle(season)}
      </h1>

      {season.episodes.length === 0 ? (
        <EmptyState title="No episodes yet" />
      ) : (
        <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {season.episodes.map((episode, index) => (
            <EpisodeCard key={episode.id} episode={episode} index={index} />
          ))}
        </ol>
      )}
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
