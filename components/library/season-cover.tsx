import type { CSSProperties } from "react";
import { LogoMark } from "@/components/layout/logo-mark";
import type { SeasonPhase } from "@/lib/script/episode-stats";
import { StatusChip } from "./episode-cover";

const ACCENTS = [
  { accent: "#2563ff", accentText: "#1a45c4" },
  { accent: "#7c5cff", accentText: "#5b3bd6" },
  { accent: "#ff4fa3", accentText: "#b01c72" },
  { accent: "#00d9ff", accentText: "#0b6a85" },
];

export function seasonStyle(seasonNumber: number, index: number) {
  const { accent, accentText } = ACCENTS[(seasonNumber - 1) % ACCENTS.length];

  return {
    "--i": index,
    "--cover-angle": `${135 + (seasonNumber - 1) * 47}deg`,
    "--accent": accent,
    "--kind-text": accentText,
  } as CSSProperties;
}

const PHASES: Record<SeasonPhase, { status: "idea" | "drafting" | "done"; label: string }> = {
  planning: { status: "idea", label: "Planning" },
  in_progress: { status: "drafting", label: "In progress" },
  complete: { status: "done", label: "Complete" },
};

export function SeasonCover({
  number,
  phase,
}: {
  number: number;
  phase: SeasonPhase;
}) {
  return (
    <div className="season-cover">
      <span aria-hidden className="season-cover-art">
        <span className="season-cover-shapes" />
        <LogoMark className="season-cover-bunny" />
      </span>

      <StatusChip {...PHASES[phase]} />

      <div className="relative text-right">
        <p className="eyebrow season-cover-label">Season</p>
        <p className="ep-numeral ml-auto">
          <span aria-hidden className="numeral-outline ep-numeral-stroke">
            {number}
          </span>
          <span className="ep-numeral-fill">{number}</span>
        </p>
      </div>
    </div>
  );
}
