import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SceneBar } from "@/components/script/scene-bar";
import { SceneWorkspace } from "@/components/editor/scene-workspace";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { sceneTitle, seasonTitle } from "@/lib/format";
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

      <SceneWorkspace
        key={scene.id}
        sceneId={scene.id}
        kind={scene.kind}
        version={scene.version}
        fields={{
          title: scene.title,
          timecode: scene.timecode,
          location: scene.location,
          beats: scene.beats,
        }}
        cast={scene.cast}
      />
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
