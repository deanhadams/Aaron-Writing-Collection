import Link from "next/link";
import type { CSSProperties } from "react";
import { SCENE_KIND_LABELS, sceneTitle } from "@/lib/format";

type Scene = {
  id: string;
  kind: keyof typeof SCENE_KIND_LABELS;
  title: string | null;
  timecode: string | null;
  location: string | null;
};

export function SceneTimeline({ scenes }: { scenes: Scene[] }) {
  return (
    <ol className="timeline space-y-4">
      {scenes.map((scene, index) => (
        <li
          key={scene.id}
          className="rise relative"
          style={{ "--i": index } as CSSProperties}
        >
          <span aria-hidden className="timeline-dot" />
          <Link href={`/scenes/${scene.id}`} className="glass glass-link p-4 sm:p-5">
            {scene.title && (
              <p className="eyebrow text-primary-strong">
                {SCENE_KIND_LABELS[scene.kind]}
              </p>
            )}
            <h2 className="text-lg font-semibold">{sceneTitle(scene)}</h2>
            {(scene.timecode || scene.location) && (
              <p className="mt-2 flex flex-wrap gap-2">
                {scene.timecode && <span className="chip">{scene.timecode}</span>}
                {scene.location && <span className="chip">{scene.location}</span>}
              </p>
            )}
          </Link>
        </li>
      ))}
    </ol>
  );
}
