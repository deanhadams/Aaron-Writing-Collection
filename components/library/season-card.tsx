import Link from "next/link";
import type { CSSProperties } from "react";
import { LogoMark } from "@/components/layout/logo-mark";
import { ProgressBar } from "@/components/ui/progress-bar";
import { formatDate, plural, seasonTitle } from "@/lib/format";

type Season = {
  id: string;
  number: number;
  title: string | null;
  seriesTitle: string;
  episodeCount: number;
  doneCount: number;
  lastEdited: Date | null;
};

export function SeasonCard({ season, index }: { season: Season; index: number }) {
  const { episodeCount, doneCount, lastEdited } = season;

  const style = {
    "--i": index,
    "--cover-angle": `${135 + season.number * 47}deg`,
    "--numeral": "white",
    "--numeral-fill": "black",
    "--numeral-blend": "screen",
  } as CSSProperties;

  return (
    <Link href={`/seasons/${season.id}`} style={style} className="glass glass-link rise">
      <div
        aria-hidden
        className="relative h-44 overflow-hidden rounded-t-2xl [background:var(--gradient-cover)]"
      >
        <LogoMark className="absolute -bottom-10 -left-6 size-52 opacity-20 mix-blend-overlay" />
        <span className="numeral-outline absolute -bottom-3 right-4 text-[9rem]">
          {season.number}
        </span>
      </div>

      <div className="p-6">
        <p className="eyebrow text-primary-strong">{season.seriesTitle}</p>
        <h2 className="mt-1 text-2xl font-semibold">{seasonTitle(season)}</h2>

        <div className="mt-5">
          <ProgressBar
            value={episodeCount ? doneCount / episodeCount : 0}
            label="Episodes done"
          />
        </div>

        <div className="mt-2 flex flex-wrap justify-between gap-x-4 text-sm text-muted">
          <span>
            {doneCount} of {plural(episodeCount, "episode")} done
          </span>
          {lastEdited && <span>Last edited {formatDate(lastEdited)}</span>}
        </div>
      </div>
    </Link>
  );
}
