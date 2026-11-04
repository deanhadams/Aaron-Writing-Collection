import Link from "next/link";
import type { ReactNode } from "react";
import { displayTitle, formatRelativeShort, plural } from "@/lib/format";
import type { getSeason } from "@/lib/queries/library";
import { coverStyle, EpisodeCover } from "./episode-cover";
import { ChatIcon, ClockIcon, LayersIcon } from "./scene-icons";
import { SceneSegments } from "./scene-segments";
import { SpeakerAvatars } from "./speaker-avatars";

type Episode = NonNullable<Awaited<ReturnType<typeof getSeason>>>["episodes"][number];

function Meta({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {icon}
      {children}
    </span>
  );
}

function editedText(edit: Episode["stats"]["lastEdited"], now: Date) {
  if (!edit) return null;
  const when = `Edited ${formatRelativeShort(edit.at, now)}`;
  return edit.by ? `${when} · ${edit.by}` : when;
}

export function EpisodeCard({
  episode,
  now,
  statusControl,
  toolbar,
}: {
  episode: Episode;
  now: Date;
  statusControl: ReactNode;
  toolbar: ReactNode;
}) {
  const { sceneCount, lineCount, runtimeMinutes, lastEdited, firstVisual } = episode.stats;
  const title = displayTitle(episode.title);
  const blurb = episode.summary || firstVisual;
  const edited = editedText(lastEdited, now);

  return (
    <article style={coverStyle(episode.number)} className="glass glass-link episode-card">
      <EpisodeCover number={episode.number} status={statusControl} toolbar={toolbar} />

      <div className="ep-body">
        <h2>
          {/* Its ::after covers the card, so the whole card is this one link. */}
          <Link href={`/episodes/${episode.id}`} className="card-link">
            <span className="ep-title">
              {title}
              <span aria-hidden className="ep-title-underline">
                <span>{title}</span>
              </span>
            </span>
          </Link>
        </h2>

        {blurb && <p className="ep-blurb">{blurb}</p>}

        {sceneCount > 0 ? (
          <>
            <p className="ep-meta">
              <Meta icon={<LayersIcon className="size-3.5" />}>{plural(sceneCount, "scene")}</Meta>
              {lineCount > 0 && <Meta icon={<ChatIcon className="size-3.5" />}>{plural(lineCount, "line")}</Meta>}
              {runtimeMinutes !== null && <Meta icon={<ClockIcon className="size-3.5" />}>{runtimeMinutes} min</Meta>}
            </p>
            <SceneSegments scenes={episode.scenes} status={episode.status} />
          </>
        ) : (
          <>
            <p className="ep-meta">No scenes yet</p>
            <span aria-hidden className="ep-empty-track" />
          </>
        )}

        <footer className="ep-footer">
          {episode.speakers.length > 0 && <SpeakerAvatars speakers={episode.speakers} />}
          <p className="ep-edited">{edited ?? "Not started"}</p>
        </footer>
      </div>
    </article>
  );
}
