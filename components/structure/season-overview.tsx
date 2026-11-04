"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { StatusChip } from "@/components/library/episode-cover";
import { ChatIcon, ClockIcon, LayersIcon } from "@/components/library/scene-icons";
import { SeasonProgress } from "@/components/library/season-progress";
import { formatRuntime, plural } from "@/lib/format";
import { seasonOverview } from "@/lib/script/episode-stats";
import { firstUnfinished, type Status } from "@/lib/structure/order";

type Episode = {
  id: string;
  number: number;
  title: string;
  status: Status;
  stats: { sceneCount: number; lineCount: number; runtimeMinutes: number | null };
};

const STATUSES: Status[] = ["idea", "drafting", "done"];

function Stat({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {icon}
      {children}
    </span>
  );
}

export function SeasonOverview({
  episodes,
  onMarkDone,
}: {
  episodes: Episode[];
  onMarkDone: (id: string) => void;
}) {
  const { counts, sceneCount, lineCount, runtimeMinutes } = seasonOverview(episodes);
  const next = firstUnfinished(episodes);

  return (
    <section aria-label="Season progress" className="glass mb-8 p-5">
      <div className="flex flex-wrap items-center gap-2">
        {STATUSES.map((status) => (
          <StatusChip key={status} status={status} label={`${counts[status]} ${status}`} />
        ))}
      </div>

      <SeasonProgress episodes={episodes} doneCount={counts.done} />

      <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm font-medium text-muted">
        <Stat icon={<LayersIcon className="size-4" />}>{plural(sceneCount, "scene")}</Stat>
        <Stat icon={<ChatIcon className="size-4" />}>{lineCount.toLocaleString("en")} lines</Stat>
        {runtimeMinutes !== null && <Stat icon={<ClockIcon className="size-4" />}>{formatRuntime(runtimeMinutes)}</Stat>}
      </p>

      {next && (
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
          <Link href={`/episodes/${next.id}`} className="btn-primary text-sm">
            Continue Episode {next.number}
          </Link>
          <button type="button" className="btn-ghost text-sm" onClick={() => onMarkDone(next.id)}>
            Mark Episode {next.number} done
          </button>
        </div>
      )}
    </section>
  );
}
