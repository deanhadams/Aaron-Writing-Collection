import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ScriptBeat } from "@/components/script/script-beat";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { SCENE_KIND_LABELS, sceneTitle, seasonTitle } from "@/lib/format";
import { getScene } from "@/lib/queries/library";

type Params = PageProps<"/scenes/[sceneId]">["params"];

async function Scene({ params }: { params: Params }) {
  const { sceneId } = await params;
  const scene = await getScene(sceneId);
  if (!scene) notFound();

  const season = { number: scene.seasonNumber, title: scene.seasonTitle };
  const slugline = [scene.timecode && `(${scene.timecode})`, scene.location]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <Breadcrumbs
        crumbs={[
          { label: "Library", href: "/" },
          { label: seasonTitle(season), href: `/seasons/${scene.seasonId}` },
          {
            label: `Episode ${scene.episodeNumber}: ${scene.episodeTitle}`,
            href: `/episodes/${scene.episodeId}`,
          },
        ]}
      />

      <article className="card mx-auto max-w-3xl px-6 py-10 font-script text-[17px] leading-relaxed sm:px-14">
        <header className="mb-8 border-b border-line pb-6 text-center">
          {scene.title && (
            <p className="font-sans text-xs font-medium uppercase tracking-wide text-primary">
              {SCENE_KIND_LABELS[scene.kind]}
            </p>
          )}
          <h1 className="mt-1 text-2xl font-semibold">{sceneTitle(scene)}</h1>
          {slugline && <p className="mt-2 font-bold">{slugline}</p>}
        </header>

        {scene.beats.length === 0 ? (
          <p className="text-center text-ink/60">This scene is empty.</p>
        ) : (
          scene.beats.map((beat) => (
            <ScriptBeat
              key={beat.id}
              beat={beat}
              characterColors={scene.characterColors}
            />
          ))
        )}
      </article>

      <nav
        aria-label="Scenes in this episode"
        className="mx-auto mt-6 flex max-w-3xl justify-between gap-4 text-sm"
      >
        {scene.previous ? (
          <Link href={`/scenes/${scene.previous.id}`} className="text-primary hover:underline">
            ← {sceneTitle(scene.previous)}
          </Link>
        ) : (
          <span />
        )}
        {scene.next && (
          <Link href={`/scenes/${scene.next.id}`} className="text-right text-primary hover:underline">
            {sceneTitle(scene.next)} →
          </Link>
        )}
      </nav>
    </>
  );
}

export default function ScenePage({ params }: PageProps<"/scenes/[sceneId]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Scene params={params} />
    </Suspense>
  );
}
