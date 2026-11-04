export type TimeTone = "day" | "morning" | "evening" | "night";

export type TimeOfDay = { label: string; tone: TimeTone };

export type ParsedLocation = {
  place: string | null;
  timeOfDay: TimeOfDay | null;
  original: string | null;
};

const TONES: Record<string, TimeTone> = {
  DAY: "day",
  MORNING: "morning",
  DAWN: "morning",
  EVENING: "evening",
  DUSK: "evening",
  TWILIGHT: "evening",
  NIGHT: "night",
};

const SCENE_PREFIX = /^(?:INT\.?\s*\/\s*EXT\.?|EXT\.?\s*\/\s*INT\.?|I\/E\.?|INT\.?|EXT\.?)\s+/i;

// Spaces around the dash are required, so "SEMI-DETACHED" stays one name.
const SEPARATOR = /\s+[-–—]\s+/;

const SMALL_WORDS = new Set(["a", "an", "and", "at", "in", "of", "on", "the", "to"]);

function titleCase(text: string) {
  let isFirst = true;

  return text.replace(/[\p{L}\p{N}][\p{L}\p{N}'’]*/gu, (word) => {
    const lower = word.toLowerCase();
    const keepSmall = !isFirst && SMALL_WORDS.has(lower);
    isFirst = false;
    return keepSmall ? lower : lower[0].toUpperCase() + lower.slice(1);
  });
}

function toneOf(segment: string): TimeOfDay | null {
  const label = segment.replace(/\(.*?\)/g, "").trim().toUpperCase();
  const tone = TONES[label];
  return tone ? { label, tone } : null;
}

// The time word must be a whole segment, so "NIGHT MARKET" stays a place.
// Anything after it ("NIGHT - CONTINUOUS") is detail, kept only in `original`.
export function parseLocation(location: string | null | undefined): ParsedLocation {
  const original = location?.trim() || null;
  if (!original) return { place: null, timeOfDay: null, original };

  const segments = original.replace(SCENE_PREFIX, "").split(SEPARATOR);
  const timeIndex = segments.findLastIndex((segment) => toneOf(segment));

  if (timeIndex === -1) {
    return { place: titleCase(segments.join(" - ")), timeOfDay: null, original };
  }

  const before = segments.slice(0, timeIndex);
  const placeSegments = before.length > 0 ? before : segments.slice(timeIndex + 1);

  return {
    place: placeSegments.length > 0 ? titleCase(placeSegments.join(" - ")) : null,
    timeOfDay: toneOf(segments[timeIndex]),
    original,
  };
}
