import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { ListRow } from "@/components/ui/list-row";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { SCENE_KIND_LABELS, sceneTitle, seasonTitle } from "@/lib/format";
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
      <p className="text-sm font-medium text-primary">
        Episode {episode.number}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-semibold">{episode.title}</h1>
        <StatusBadge status={episode.status} />
      </div>
      {episode.summary && (
        <p className="mt-3 max-w-2xl text-ink/70">{episode.summary}</p>
      )}

      {episode.scenes.length === 0 ? (
        <p className="card mt-6 p-8 text-center text-ink/70">No scenes yet.</p>
      ) : (
        <ol className="mt-6 space-y-3">
          {episode.scenes.map((scene) => (
            <ListRow key={scene.id} href={`/scenes/${scene.id}`}>
              <span className="flex-1">
                {scene.title && (
                  <span className="block text-xs font-medium uppercase tracking-wide text-primary">
                    {SCENE_KIND_LABELS[scene.kind]}
                  </span>
                )}
                <span className="block font-medium">{sceneTitle(scene)}</span>
                {scene.location && (
                  <span className="block font-script text-sm text-ink/60">
                    {scene.location}
                  </span>
                )}
              </span>
              {scene.timecode && (
                <span className="font-script text-sm text-ink/60">
                  {scene.timecode}
                </span>
              )}
            </ListRow>
          ))}
        </ol>
      )}
    </>
  );
}

export default function EpisodePage({
  params,
}: PageProps<"/episodes/[episodeId]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Episode params={params} />
    </Suspense>
  );
}
