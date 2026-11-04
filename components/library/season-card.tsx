import Link from "next/link";
import type { ReactNode } from "react";
import { formatRelative, formatRuntime, plural, seasonTitle } from "@/lib/format";
import type { getSeasonCards } from "@/lib/queries/library";
import { ArrowIcon, ChatIcon, ClockIcon, FilmIcon, LayersIcon } from "./scene-icons";
import { SeasonCover, seasonStyle } from "./season-cover";
import { SeasonProgress } from "./season-progress";
import { SpeakerAvatars } from "./speaker-avatars";

type Season = Awaited<ReturnType<typeof getSeasonCards>>[number];

function Meta({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {icon}
      {children}
    </span>
  );
}

function editedText(edit: Season["stats"]["lastEdited"], now: Date) {
  if (!edit) return null;
  const when = formatRelative(edit.at, now);
  return edit.by ? `Last edited by ${edit.by} · ${when}` : `Last edited ${when}`;
}

export function SeasonCard({
  season,
  index,
  now,
}: {
  season: Season;
  index: number;
  now: Date;
}) {
  const { stats, episodes, speakers } = season;
  const title = seasonTitle(season);
  const edited = editedText(stats.lastEdited, now);
  const href = `/seasons/${season.id}`;

  return (
    <article
      style={seasonStyle(season.number, index)}
      className="glass glass-link season-card rise"
    >
      <SeasonCover number={season.number} phase={stats.phase} />

      <div className="flex flex-1 flex-col p-6">
        <p className="eyebrow text-primary-strong">{season.seriesTitle}</p>
        <h2 className="mt-1 text-2xl font-semibold leading-snug">
          {/* Its ::after covers the card, so the whole card is this one link. */}
          <Link href={href} className="season-card-link">
            <span className="season-title">
              {title}
              <span aria-hidden className="ep-title-underline">
                <span>{title}</span>
              </span>
            </span>
          </Link>
        </h2>

        {season.description && (
          <p className="mt-1 truncate text-sm text-muted">{season.description}</p>
        )}

        {stats.episodeCount > 0 && (
          <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium text-muted">
            <Meta icon={<FilmIcon className="size-3.5" />}>
              {plural(stats.episodeCount, "episode")}
            </Meta>
            {stats.sceneCount > 0 && (
              <Meta icon={<LayersIcon className="size-3.5" />}>
                {plural(stats.sceneCount, "scene")}
              </Meta>
            )}
            {stats.lineCount > 0 && (
              <Meta icon={<ChatIcon className="size-3.5" />}>
                {plural(stats.lineCount, "line")}
              </Meta>
            )}
            {stats.runtimeMinutes !== null && (
              <Meta icon={<ClockIcon className="size-3.5" />}>
                {formatRuntime(stats.runtimeMinutes)}
              </Meta>
            )}
          </p>
        )}

        {episodes.length > 0 && (
          <SeasonProgress episodes={episodes} doneCount={stats.doneCount} />
        )}

        <div className="mt-auto pt-5">
          {(speakers.length > 0 || edited) && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
              {speakers.length > 0 && <SpeakerAvatars speakers={speakers} max={5} />}
              {edited && (
                <p className="ml-auto text-right text-xs text-balance text-muted">
                  {edited}
                </p>
              )}
            </div>
          )}

          <div className="season-card-actions">
            {stats.continueSceneId && (
              <Link href={`/scenes/${stats.continueSceneId}`} className="btn-primary text-sm">
                Continue writing
                <span className="sr-only"> {title}</span>
              </Link>
            )}
            <Link href={href} className="btn-ghost inline-flex items-center gap-1 text-sm">
              View episodes
              <span className="sr-only"> of {title}</span>
              <ArrowIcon className="season-card-arrow" />
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
