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

const DAY_WORDS = ["DAY", "DAWN", "MORNING", "NOON", "AFTERNOON", "SUNRISE"];
const NIGHT_WORDS = ["NIGHT", "MIDNIGHT", "DUSK", "EVENING", "SUNSET", "TWILIGHT"];

export type TimeOfDay = { label: string; period: "day" | "night" };

// Splits "LANTERN STREET - DUSK". The word must follow a dash, so a place like
// "DAY CARE" or "NIGHT MARKET" is never mistaken for a time of day.
export function parseLocation(location: string | null): {
  place: string | null;
  timeOfDay: TimeOfDay | null;
} {
  const match = location?.match(/^(.*\S)\s+[-–—]\s+(.+?)\s*$/);
  const label = match?.[2].toUpperCase() ?? "";

  if (DAY_WORDS.includes(label)) {
    return { place: match![1], timeOfDay: { label, period: "day" } };
  }
  if (NIGHT_WORDS.includes(label)) {
    return { place: match![1], timeOfDay: { label, period: "night" } };
  }
  return { place: location?.trim() || null, timeOfDay: null };
}

export function formatTimecode(timecode: string) {
  return timecode.replace(/\s*-\s*/, " – ");
}
