import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SceneBar } from "@/components/script/scene-bar";
import { LocationChips } from "@/components/library/location-chips";
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
  const title = sceneTitle(scene);

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

      <SceneBar title={title} previous={scene.previous} next={scene.next} />

      <article
        data-kind={scene.kind}
        className="script-page rise mx-auto max-w-3xl px-5 py-10 font-script text-[17px] leading-relaxed sm:px-20 sm:py-16"
      >
        <header className="mb-10 text-center">
          {scene.title && (
            <p className="eyebrow font-sans text-primary-strong">
              {SCENE_KIND_LABELS[scene.kind]}
            </p>
          )}
          <h1 className="mt-1 text-3xl font-bold tracking-tight">{title}</h1>
          {scene.timecode && (
            <p className="mt-3 font-bold">({scene.timecode})</p>
          )}
          <LocationChips
            location={scene.location}
            className="mt-3 justify-center"
          />
        </header>

        {scene.beats.length === 0 ? (
          <p className="text-center text-muted">This scene is empty.</p>
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
    </>
  );
}

export default function ScenePage({ params }: PageProps<"/scenes/[sceneId]">) {
  return (
    <Suspense fallback={<PageSkeleton shape="script" />}>
      <Scene params={params} />
    </Suspense>
  );
}
