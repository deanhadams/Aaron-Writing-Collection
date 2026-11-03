import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SceneTimeline } from "@/components/library/scene-timeline";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { EmptyState } from "@/components/ui/empty-state";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { seasonTitle } from "@/lib/format";
import { getEpisode } from "@/lib/queries/library";

type Params = PageProps<"/episodes/[episodeId]">["params"];

async function Episode({ params }: { params: Params }) {
  const { episodeId } = await params;
  const episode = await getEpisode(episodeId);
  if (!episode) notFound();

  const season = { number: episode.seasonNumber, title: episode.seasonTitle };

  return (
    <>
      <Breadcrumbs
        crumbs={[
          { label: "Library", href: "/" },
          { label: seasonTitle(season), href: `/seasons/${episode.seasonId}` },
        ]}
      />
      <div className="flex items-center gap-3">
        <p className="eyebrow text-primary-strong">Episode {episode.number}</p>
        <StatusBadge status={episode.status} />
      </div>
      <h1 className="text-gradient mt-1 w-fit text-4xl font-bold tracking-tight sm:text-5xl">
        {episode.title}
      </h1>
      {episode.summary && (
        <p className="mt-3 max-w-2xl text-lg text-muted">{episode.summary}</p>
      )}

      <div className="mt-8">
        {episode.scenes.length === 0 ? (
          <EmptyState title="No scenes yet" />
        ) : (
          <div className="max-w-3xl">
            <SceneTimeline scenes={episode.scenes} />
          </div>
        )}
      </div>
    </>
  );
}

export default function EpisodePage({
  params,
}: PageProps<"/episodes/[episodeId]">) {
  return (
    <Suspense fallback={<PageSkeleton shape="timeline" />}>
      <Episode params={params} />
    </Suspense>
  );
}
