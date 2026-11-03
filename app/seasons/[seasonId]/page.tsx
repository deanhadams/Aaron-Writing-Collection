import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { ListRow } from "@/components/ui/list-row";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { plural, seasonTitle } from "@/lib/format";
import { getSeason } from "@/lib/queries/library";

type Params = PageProps<"/seasons/[seasonId]">["params"];

async function Season({ params }: { params: Params }) {
  const { seasonId } = await params;
  const season = await getSeason(seasonId);
  if (!season) notFound();

  return (
    <>
      <Breadcrumbs crumbs={[{ label: "Library", href: "/" }]} />
      <p className="text-sm font-medium text-primary">{season.seriesTitle}</p>
      <h1 className="mb-6 text-3xl font-semibold">{seasonTitle(season)}</h1>

      {season.episodes.length === 0 ? (
        <p className="card p-8 text-center text-ink/70">No episodes yet.</p>
      ) : (
        <ol className="space-y-3">
          {season.episodes.map((episode) => (
            <ListRow key={episode.id} href={`/episodes/${episode.id}`}>
              <span className="w-8 font-heading text-xl font-semibold text-primary">
                {episode.number}
              </span>
              <span className="flex-1 font-medium">{episode.title}</span>
              <span className="hidden text-sm text-ink/60 sm:inline">
                {plural(episode.sceneCount, "scene")}
              </span>
              <StatusBadge status={episode.status} />
            </ListRow>
          ))}
        </ol>
      )}
    </>
  );
}

export default function SeasonPage({ params }: PageProps<"/seasons/[seasonId]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Season params={params} />
    </Suspense>
  );
}
