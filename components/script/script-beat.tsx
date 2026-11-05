import Link from "next/link";
import type { CSSProperties } from "react";
import type { Beat } from "@/lib/db/schema";
import { speakerParts, splitSpeakers, voiceName } from "@/lib/script/scene-summary";

type Colors = Map<string, string | null>;
type Links = Map<string, string>;

const DEFAULT_COLOR = "var(--color-primary-strong)";

function SpeakerName({ name, colors, links }: { name: string; colors: Colors; links?: Links }) {
  const className =
    "rounded-md px-2 py-0.5 font-bold uppercase text-(--char) [background:color-mix(in_srgb,var(--char)_7%,transparent)]";
  const style = { "--char": colors.get(name) || DEFAULT_COLOR } as CSSProperties;
  const slug = links?.get(name);

  return slug ? (
    <Link href={`/characters/${slug}`} className={`${className} hover:underline`} style={style}>
      {name}
    </Link>
  ) : (
    <span className={className} style={style}>
      {name}
    </span>
  );
}

function Dialogue({
  names,
  suffix,
  beat,
  colors,
  links,
}: {
  names: string;
  suffix?: string;
  beat: Beat;
  colors: Colors;
  links?: Links;
}) {
  return (
    <div id={`beat-${beat.id}`} className="mx-auto my-7 max-w-md">
      <p className="text-center">
        {speakerParts(names).map(({ text, isName }, index) =>
          isName ? <SpeakerName key={index} name={text} colors={colors} links={links} /> : text,
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
  characterLinks,
}: {
  beat: Beat;
  characterColors: Colors;
  characterLinks?: Links;
}) {
  const character = beat.character?.toUpperCase();

  switch (beat.type) {
    case "dialogue":
      return <Dialogue names={character ?? ""} beat={beat} colors={characterColors} links={characterLinks} />;
    case "vo": {
      const hasRecord = splitSpeakers(character ?? "").some((name) => characterColors.has(name));
      const label = voiceName(character, hasRecord);

      return character && hasRecord ? (
        <Dialogue names={character} suffix="(V.O.)" beat={beat} colors={characterColors} links={characterLinks} />
      ) : (
        <Dialogue names={label} beat={beat} colors={characterColors} />
      );
    }
    case "visual":
      return (
        <p id={`beat-${beat.id}`} className="my-5 whitespace-pre-wrap border-l-2 border-primary pl-4 italic">
          <span className="sr-only">Visual: </span>
          {beat.text}
        </p>
      );
    case "sound":
      return (
        <p id={`beat-${beat.id}`} className="my-5 flex gap-3 whitespace-pre-wrap italic">
          <WaveformIcon />
          <span>
            <span className="sr-only">Sound: </span>
            {beat.text}
          </span>
        </p>
      );
    case "action":
      return (
        <p id={`beat-${beat.id}`} className="my-5 whitespace-pre-wrap">
          {beat.text}
        </p>
      );
    case "note":
      return (
        <p id={`beat-${beat.id}`} className="my-5 whitespace-pre-wrap rounded-r-lg border-l-2 border-neon bg-neon/10 px-4 py-2 font-sans text-sm">
          {beat.text}
        </p>
      );
  }
}
