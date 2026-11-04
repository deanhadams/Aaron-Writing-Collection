import type { CSSProperties } from "react";
import { CheckIcon } from "./scene-icons";

type Status = "idea" | "drafting" | "done";

// The first stop stays deep because the white label and numeral sit on it.
// Six covers means cards next to or above each other never match in a 2 or 3
// column grid.
const COVERS = [
  { stops: ["#1a45c4", "#7c5cff", "#00d9ff"], accent: "#2563ff", accentText: "#1a45c4" },
  { stops: ["#5b3bd6", "#ff4fa3", "#ffc2dd"], accent: "#7c5cff", accentText: "#5b3bd6" },
  { stops: ["#0a6c9f", "#00d9ff", "#7c5cff"], accent: "#00d9ff", accentText: "#0b6a85" },
  { stops: ["#b01c72", "#ff4fa3", "#7c5cff"], accent: "#ff4fa3", accentText: "#b01c72" },
  { stops: ["#1a45c4", "#00d9ff", "#ff4fa3"], accent: "#2563ff", accentText: "#1a45c4" },
  { stops: ["#5b3bd6", "#2563ff", "#00d9ff"], accent: "#7c5cff", accentText: "#5b3bd6" },
];

export function coverStyle(episodeNumber: number) {
  const index = (((episodeNumber - 1) % COVERS.length) + COVERS.length) % COVERS.length;
  const { stops, accent, accentText } = COVERS[index];

  return {
    "--cover-a": stops[0],
    "--cover-b": stops[1],
    "--cover-c": stops[2],
    "--cover-angle": `${100 + index * 14}deg`,
    "--accent": accent,
    "--kind-text": accentText,
  } as CSSProperties;
}

function StatusChip({ status }: { status: Status }) {
  return (
    <span className="ep-status" data-status={status}>
      {status === "done" ? (
        <CheckIcon className="size-3.5" />
      ) : (
        <span aria-hidden className="ep-status-dot" />
      )}
      {status}
    </span>
  );
}

export function EpisodeCover({
  number,
  status,
}: {
  number: number;
  status: Status;
}) {
  return (
    <div className="ep-cover">
      <span aria-hidden className="ep-cover-art" />
      <div className="relative">
        <p className="eyebrow text-white">Episode</p>
        <p className="ep-numeral">
          <span aria-hidden className="numeral-outline ep-numeral-stroke">
            {number}
          </span>
          <span className="ep-numeral-fill">{number}</span>
        </p>
      </div>
      <StatusChip status={status} />
    </div>
  );
}
