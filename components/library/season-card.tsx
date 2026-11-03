import Link from "next/link";
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

export function SeasonCard({ season }: { season: Season }) {
  const { episodeCount, doneCount, lastEdited } = season;
  const percent = episodeCount ? (doneCount / episodeCount) * 100 : 0;

  return (
    <Link href={`/seasons/${season.id}`} className="card card-link block p-6">
      <p className="text-sm font-medium text-primary">{season.seriesTitle}</p>
      <h2 className="mt-1 text-2xl font-semibold">{seasonTitle(season)}</h2>

      <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="mt-2 flex justify-between gap-4 text-sm text-ink/70">
        <span>
          {doneCount} of {plural(episodeCount, "episode")} done
        </span>
        {lastEdited && <span>Edited {formatDate(lastEdited)}</span>}
      </div>
    </Link>
  );
}
