import type { Beat, BeatType } from "@/lib/db/schema";
import { voiceName } from "./scene-summary";

export function hasSpeaker(type: BeatType) {
  return type === "dialogue" || type === "vo";
}

/**
 * The stored shape of a beat. While editing, a beat keeps its speaker through
 * type changes, so cycling past Visual and back loses nothing.
 */
export function normalizeBeat(beat: Beat): Beat {
  const { id, type, text } = beat;
  if (!hasSpeaker(type)) return { id, type, text };

  const character = beat.character?.trim();
  const parenthetical = beat.parenthetical?.trim();

  return {
    id,
    type,
    ...(character && { character }),
    ...(parenthetical && { parenthetical }),
    text,
  };
}

/** The script as plain text, for copying out of the editor. */
export function beatsToPlainText(beats: Beat[]) {
  return beats
    .map(({ type, character, parenthetical, text }) => {
      const aside = parenthetical ? `(${parenthetical}) ` : "";
      if (hasSpeaker(type)) {
        const name = type === "vo" ? voiceName(character, true) : character;
        return `${name ? `${name}: ` : ""}${aside}${text}`;
      }
      return `${type.toUpperCase()}: ${text}`;
    })
    .join("\n\n");
}
