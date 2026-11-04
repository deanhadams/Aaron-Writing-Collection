import Link from "next/link";
import type { CSSProperties } from "react";
import { SCENE_KIND_LABELS, plural, sceneTitle } from "@/lib/format";
import type { getEpisode } from "@/lib/queries/library";
import { formatTimecode, summarizeBeats } from "@/lib/script/scene-summary";
import { LocationChips } from "./location-chips";
import { ArrowIcon, KIND_ICONS } from "./scene-icons";
import { SpeakerAvatars } from "./speaker-avatars";

export type SceneCardData = NonNullable<
  Awaited<ReturnType<typeof getEpisode>>
>["scenes"][number];

function Marker({
  kind,
  number,
  className,
}: {
  kind: SceneCardData["kind"];
  number: number | null;
  className?: string;
}) {
  if (kind === "scene") return number;
  const KindIcon = KIND_ICONS[kind];
  return <KindIcon className={className} />;
}

export function SceneCard({
  scene,
  number,
  index,
}: {
  scene: SceneCardData;
  number: number | null;
  index: number;
}) {
  const { lineCount, preview } = summarizeBeats(scene.beats);
  const stats = [
    lineCount > 0 && plural(lineCount, "line"),
    scene.timecode && formatTimecode(scene.timecode),
  ].filter(Boolean);
  const hasAside = scene.speakers.length > 0 || stats.length > 0;

  return (
    <li
      data-kind={scene.kind}
      className="rise relative"
      style={{ "--i": index } as CSSProperties}
    >
      <span aria-hidden className="timeline-node">
        <Marker kind={scene.kind} number={number} className="size-4" />
      </span>

      <Link href={`/scenes/${scene.id}`} className="glass glass-link scene-card">
        <span aria-hidden className="scene-card-art">
          <span className="scene-card-watermark">
            <Marker kind={scene.kind} number={number} className="size-32" />
          </span>
        </span>

        <div className="relative p-5 pl-6 sm:pr-14">
          <div className="grid gap-x-8 gap-y-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            <div className="min-w-0">
              {scene.title && (
                <p className="eyebrow scene-card-kind">
                  {SCENE_KIND_LABELS[scene.kind]}
                </p>
              )}
              <h2 className="mt-0.5 text-xl font-semibold leading-snug sm:text-2xl">
                {sceneTitle(scene)}
              </h2>
              {preview && <p className="scene-card-preview">{preview}</p>}
            </div>

            {hasAside && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 sm:flex-col sm:items-end">
                {scene.speakers.length > 0 && (
                  <SpeakerAvatars speakers={scene.speakers} />
                )}
                {stats.length > 0 && (
                  <p className="eyebrow text-muted">{stats.join(" · ")}</p>
                )}
              </div>
            )}
          </div>

          <LocationChips location={scene.location} className="mt-3" />
        </div>

        <ArrowIcon className="scene-card-arrow" />
      </Link>
    </li>
  );
}
