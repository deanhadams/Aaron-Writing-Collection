import type { Beat } from "@/lib/db/schema";

const isSpoken = (beat: Beat) => beat.type === "dialogue" || beat.type === "vo";

export function speakerLineCounts(beats: Beat[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const beat of beats) {
    const name = beat.character?.trim().toUpperCase();
    if (isSpoken(beat) && name) counts.set(name, (counts.get(name) ?? 0) + 1);
  }

  return counts;
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
