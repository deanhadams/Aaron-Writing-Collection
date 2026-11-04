import Link from "next/link";
import { displayTitle, sceneTitle, type SceneKind } from "@/lib/format";

type Scene = { id: string; kind: SceneKind; title: string | null };

/**
 * One segment per scene, tinted by kind. Mouse only, like the lines chart: the
 * meta row gives the count and the episode page lists every scene, so 120 extra
 * tab stops would add nothing for keyboards or screen readers.
 */
export function SceneSegments({ scenes, status }: { scenes: Scene[]; status: string }) {
  return (
    <div aria-hidden className="ep-segments" data-status={status}>
      {scenes.map((scene, index) => (
        <Link
          key={scene.id}
          href={`/scenes/${scene.id}`}
          prefetch={false}
          tabIndex={-1}
          data-kind={scene.kind}
          data-side={index >= scenes.length / 2 ? "end" : undefined}
          className="ep-segment"
        >
          <span className="ep-segment-fill" />
          <span className="chip-tooltip">{displayTitle(sceneTitle(scene))}</span>
        </Link>
      ))}
    </div>
  );
}
