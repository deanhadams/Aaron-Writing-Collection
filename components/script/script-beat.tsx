import type { CSSProperties } from "react";
import type { Beat } from "@/lib/db/schema";
import { speakerParts, splitSpeakers, voiceName } from "@/lib/script/scene-summary";

type Colors = Map<string, string | null>;

const DEFAULT_COLOR = "var(--color-primary-strong)";

function SpeakerName({ name, colors }: { name: string; colors: Colors }) {
  return (
    <span
      className="rounded-md px-2 py-0.5 font-bold uppercase text-(--char) [background:color-mix(in_srgb,var(--char)_7%,transparent)]"
      style={{ "--char": colors.get(name) || DEFAULT_COLOR } as CSSProperties}
    >
      {name}
    </span>
  );
}

function Dialogue({
  names,
  suffix,
  beat,
  colors,
}: {
  names: string;
  suffix?: string;
  beat: Beat;
  colors: Colors;
}) {
  return (
    <div className="mx-auto my-7 max-w-md">
      <p className="text-center">
        {speakerParts(names).map(({ text, isName }, index) =>
          isName ? <SpeakerName key={index} name={text} colors={colors} /> : text,
        )}
        {suffix && <span className="font-bold text-muted"> {suffix}</span>}
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
  characterColors: Colors;
}) {
  const character = beat.character?.toUpperCase();

  switch (beat.type) {
    case "dialogue":
      return <Dialogue names={character ?? ""} beat={beat} colors={characterColors} />;
    case "vo": {
      const hasRecord = splitSpeakers(character ?? "").some((name) => characterColors.has(name));
      const label = voiceName(character, hasRecord);

      return character && hasRecord ? (
        <Dialogue names={character} suffix="(V.O.)" beat={beat} colors={characterColors} />
      ) : (
        <Dialogue names={label} beat={beat} colors={characterColors} />
      );
    }
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
