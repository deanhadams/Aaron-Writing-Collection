import Link from "next/link";
import type { ReactNode } from "react";
import { formatRelative, plural } from "@/lib/format";
import type { getSeason } from "@/lib/queries/library";
import { coverStyle, EpisodeCover } from "./episode-cover";
import { ArrowIcon, ChatIcon, ClockIcon, LayersIcon } from "./scene-icons";
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

function Blurb({ episode }: { episode: Episode }) {
  if (episode.summary) {
    return <p className="mt-1 truncate text-sm text-muted">{episode.summary}</p>;
  }
  if (episode.stats.firstVisual) {
    return <p className="script-preview text-sm">{episode.stats.firstVisual}</p>;
  }
  return null;
}

function editedText(edit: Episode["stats"]["lastEdited"], now: Date) {
  if (!edit) return null;
  const when = formatRelative(edit.at, now);
  return edit.by ? `Last edited by ${edit.by} · ${when}` : `Last edited ${when}`;
}

export function EpisodeCard({
  episode,
  now,
  statusControl,
  tools,
}: {
  episode: Episode;
  now: Date;
  statusControl: ReactNode;
  tools: ReactNode;
}) {
  const { sceneCount, lineCount, runtimeMinutes, lastEdited } = episode.stats;
  const edited = editedText(lastEdited, now);
  const hasFooter = episode.speakers.length > 0 || edited;

  return (
    <article style={coverStyle(episode.number)} className="glass glass-link episode-card">
        <EpisodeCover number={episode.number}>{statusControl}</EpisodeCover>

        <div className="flex flex-1 flex-col p-5">
          <h2>
            {/* Its ::after covers the card, so the whole card is this one link. */}
            <Link href={`/episodes/${episode.id}`} className="card-link">
              <span className="ep-title">
                {episode.title}
                <span aria-hidden className="ep-title-underline">
                  <span>{episode.title}</span>
                </span>
              </span>
            </Link>
          </h2>

          <Blurb episode={episode} />

          {sceneCount > 0 && (
            <>
              <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium text-muted">
                <Meta icon={<LayersIcon className="size-3.5" />}>
                  {plural(sceneCount, "scene")}
                </Meta>
                {lineCount > 0 && (
                  <Meta icon={<ChatIcon className="size-3.5" />}>
                    {plural(lineCount, "line")}
                  </Meta>
                )}
                {runtimeMinutes !== null && (
                  <Meta icon={<ClockIcon className="size-3.5" />}>
                    {runtimeMinutes} min
                  </Meta>
                )}
              </p>

              <div aria-hidden className="ep-segments" data-status={episode.status}>
                {Array.from({ length: sceneCount }, (_, segment) => (
                  <span key={segment} />
                ))}
              </div>
            </>
          )}

          {hasFooter && (
            <div className="mt-auto flex items-center justify-between gap-3 pt-4 pr-6">
              {episode.speakers.length > 0 && (
                <SpeakerAvatars speakers={episode.speakers} />
              )}
              {edited && (
                <p className="ml-auto text-right text-xs text-balance text-muted">
                  {edited}
                </p>
              )}
            </div>
          )}

          <div className="card-tools">{tools}</div>
        </div>

        <ArrowIcon className="episode-card-arrow" />
    </article>
  );
}
