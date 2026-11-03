import type { Beat } from "@/lib/db/schema";

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
    <div className="mx-auto my-6 max-w-md">
      <p className="text-center font-bold uppercase" style={{ color }}>
        {name}
      </p>
      {beat.parenthetical && (
        <p className="text-center italic text-ink/70">({beat.parenthetical})</p>
      )}
      <p className="whitespace-pre-wrap">{beat.text}</p>
    </div>
  );
}

function Direction({ label, text }: { label: string; text: string }) {
  return (
    <p className="my-4 whitespace-pre-wrap italic text-ink/80">
      <span className="font-bold not-italic text-primary">{label}: </span>
      {text}
    </p>
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
    (character && characterColors.get(character)) || "var(--color-primary)";

  switch (beat.type) {
    case "dialogue":
      return <Dialogue name={character ?? ""} beat={beat} color={color} />;
    case "vo":
      return (
        <Dialogue
          name={character ? `${character} (V.O.)` : "V.O."}
          beat={beat}
          color={color}
        />
      );
    case "visual":
      return <Direction label="VISUAL" text={beat.text} />;
    case "sound":
      return <Direction label="SOUND" text={beat.text} />;
    case "action":
      return <p className="my-4 whitespace-pre-wrap pl-6">{beat.text}</p>;
    case "note":
      return (
        <p className="my-4 whitespace-pre-wrap rounded-r-lg border-l-2 border-neon bg-neon/10 px-4 py-2 font-sans text-sm">
          {beat.text}
        </p>
      );
  }
}
