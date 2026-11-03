import Link from "next/link";
import type { CSSProperties } from "react";
import { StatusBadge } from "@/components/ui/status-badge";
import { plural } from "@/lib/format";

type Episode = {
  id: string;
  number: number;
  title: string;
  status: "idea" | "drafting" | "done";
  sceneCount: number;
};

export function EpisodeCard({ episode, index }: { episode: Episode; index: number }) {
  return (
    <li className="rise" style={{ "--i": index } as CSSProperties}>
      <Link
        href={`/episodes/${episode.id}`}
        className="glass glass-link flex! h-full flex-col p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <span className="numeral-outline text-6xl">{episode.number}</span>
          <StatusBadge status={episode.status} />
        </div>
        <h2 className="mt-4 text-xl font-semibold leading-snug">{episode.title}</h2>
        <p className="eyebrow mt-auto pt-3 text-muted">
          {plural(episode.sceneCount, "scene")}
        </p>
      </Link>
    </li>
  );
}
