import type { Beat } from "@/lib/db/schema";

const isSpoken = (beat: Beat) => beat.type === "dialogue" || beat.type === "vo";

/** A line can belong to several people: "REVOC & DESRUC", "A, B, C", "A / B". */
export function splitSpeakers(name: string) {
  return name.split(/\s*[,&/]\s*/).filter(Boolean);
}

export function speakerLineCounts(beats: Beat[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const beat of beats) {
    if (!isSpoken(beat) || !beat.character) continue;

    for (const name of splitSpeakers(beat.character.trim().toUpperCase())) {
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }

  return counts;
}

/** A voice with no character record, like INTERCOM, shows its label alone. */
export function voiceName(character: string | undefined, hasRecord: boolean) {
  if (!character) return "V.O.";
  return hasRecord ? `${character} (V.O.)` : character;
}

export function summarizeBeats(beats: Beat[]) {
  const first = beats.find(
    (beat) =>
      (beat.type === "visual" || beat.type === "dialogue") && beat.text.trim(),
  );

  return {
    lineCount: beats.filter(isSpoken).length,
    preview: first
      ? [first.character, first.text.trim()].filter(Boolean).join(": ")
      : null,
  };
}

export function formatTimecode(timecode: string) {
  return timecode.replace(/\s*-\s*/, " – ");
}
