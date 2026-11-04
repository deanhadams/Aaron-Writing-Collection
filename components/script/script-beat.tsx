import type { CSSProperties } from "react";
import type { Beat } from "@/lib/db/schema";
import { voiceName } from "@/lib/script/scene-summary";

function Dialogue({
  name,
  beat,
  color,
}: {
  name: string;
  beat: Beat;
  color: string;
}) {
  return (
    <div className="mx-auto my-7 max-w-md">
      <p className="text-center">
        <span
          className="rounded-md px-2 py-0.5 font-bold uppercase text-(--char) [background:color-mix(in_srgb,var(--char)_7%,transparent)]"
          style={{ "--char": color } as CSSProperties}
        >
          {name}
        </span>
      </p>
      {beat.parenthetical && (
        <p className="text-center italic text-muted">({beat.parenthetical})</p>
      )}
      <p className="mt-1 whitespace-pre-wrap">{beat.text}</p>
    </div>
  );
}

function WaveformIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="mt-1 size-5 shrink-0 text-primary"
      fill="currentColor"
    >
      <rect x="2" y="9" width="2.5" height="6" rx="1.25" />
      <rect x="7" y="5" width="2.5" height="14" rx="1.25" />
      <rect x="12" y="2" width="2.5" height="20" rx="1.25" />
      <rect x="17" y="7" width="2.5" height="10" rx="1.25" />
    </svg>
  );
}

export function ScriptBeat({
  beat,
  characterColors,
}: {
  beat: Beat;
  characterColors: Map<string, string | null>;
}) {
  const character = beat.character?.toUpperCase();
  const color =
    (character && characterColors.get(character)) ||
    "var(--color-primary-strong)";

  switch (beat.type) {
    case "dialogue":
      return <Dialogue name={character ?? ""} beat={beat} color={color} />;
    case "vo":
      return (
        <Dialogue
          name={voiceName(character, Boolean(character && characterColors.has(character)))}
          beat={beat}
          color={color}
        />
      );
    case "visual":
      return (
        <p className="my-5 whitespace-pre-wrap border-l-2 border-primary pl-4 italic">
          <span className="sr-only">Visual: </span>
          {beat.text}
        </p>
      );
    case "sound":
      return (
        <p className="my-5 flex gap-3 whitespace-pre-wrap italic">
          <WaveformIcon />
          <span>
            <span className="sr-only">Sound: </span>
            {beat.text}
          </span>
        </p>
      );
    case "action":
      return <p className="my-5 whitespace-pre-wrap">{beat.text}</p>;
    case "note":
      return (
        <p className="my-5 whitespace-pre-wrap rounded-r-lg border-l-2 border-neon bg-neon/10 px-4 py-2 font-sans text-sm">
          {beat.text}
        </p>
      );
  }
}
