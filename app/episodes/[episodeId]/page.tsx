import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EpisodeControls } from "@/components/structure/episode-controls";
import { SceneBoard } from "@/components/structure/scene-board";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { PageSkeleton } from "@/components/ui/page-skeleton";
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
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="eyebrow text-primary-strong">Episode {episode.number}</p>
        <EpisodeControls episode={episode} />
        <Link href={`/read/${episode.seasonId}/${episode.id}`} className="btn-ghost text-sm">
          Read
        </Link>
        <a href={`/api/export/episodes/${episode.id}`} className="btn-ghost text-sm">
          Download Word
        </a>
      </div>
      <h1 className="text-gradient mt-1 w-fit text-4xl font-bold tracking-tight sm:text-5xl">
        {episode.title}
      </h1>
      {episode.summary && (
        <p className="mt-3 max-w-2xl whitespace-pre-wrap text-lg text-muted">{episode.summary}</p>
      )}
      {(episode.openingTheme || episode.outroTheme) && (
        <p className="mt-2 text-sm text-muted">
          {[
            episode.openingTheme && `Opening: ${episode.openingTheme}`,
            episode.outroTheme && `Outro: ${episode.outroTheme}`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}

      <div className="mt-8">
        <SceneBoard episode={episode} />
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
