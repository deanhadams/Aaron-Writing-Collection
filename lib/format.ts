export type SceneKind = "prologue" | "scene" | "outro" | "post_credit";

export const SCENE_KIND_LABELS: Record<SceneKind, string> = {
  prologue: "Prologue",
  scene: "Scene",
  outro: "Episode Outro",
  post_credit: "Post-Credit Scene",
};

export function sceneTitle(scene: { kind: SceneKind; title: string | null }) {
  return scene.title ?? SCENE_KIND_LABELS[scene.kind];
}

export function seasonTitle(season: { number: number; title: string | null }) {
  const label = `Season ${season.number}`;
  return season.title ? `${label}: ${season.title}` : label;
}

const SMALL_WORDS = new Set(["a", "an", "and", "as", "at", "but", "by", "for", "in", "of", "on", "or", "the", "to", "vs"]);
const ROMAN_NUMERAL = /^(?:II|III|IV|VI|VII|VIII|IX|XI|XII)$/;
const DOTTED_LETTERS = /^(?:\p{Lu}\.){2,}$/u;

function titleCaseWord(word: string, keepCapital: boolean): string {
  if (/\p{Ll}/u.test(word)) return word;

  const letters = word.replace(/[^\p{L}.]/gu, "");
  if (DOTTED_LETTERS.test(letters) || ROMAN_NUMERAL.test(letters)) return word;

  const lower = word.toLowerCase();
  if (!keepCapital && SMALL_WORDS.has(lower.replace(/\P{L}/gu, ""))) return lower;
  return lower.replace(/\p{L}/u, (letter) => letter.toUpperCase());
}

/**
 * Titles written in capitals, read as title case. Anything already in mixed
 * case is left as typed, and a mixed-case aside doesn't count: "THE BIG FIVE
 * (Part 1)" is still shouting. Display only, so the stored title never changes.
 */
export function displayTitle(title: string) {
  const outsideBrackets = title.replace(/\([^)]*\)/g, "");
  if (/\p{Ll}/u.test(outsideBrackets) || !/\p{Lu}/u.test(outsideBrackets)) return title;

  const words = title.split(/\s+/).filter(Boolean);

  return words
    .map((word, index) => {
      const startsPhrase = index === 0 || word.startsWith("(") || /[:!?.]$/.test(words[index - 1]);
      const endsPhrase = index === words.length - 1 || word.endsWith(")");
      // "DESIRE/CONNECT" and "HALF-LIFE" are each two words.
      const parts = word.split(/([/-])/);
      return parts
        .map((part) => titleCaseWord(part, startsPhrase || endsPhrase || parts.length > 1))
        .join("");
    })
    .join(" ");
}

export function plural(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

export function formatRuntime(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `~${rest}m`;
  return rest === 0 ? `~${hours}h` : `~${hours}h ${rest}m`;
}

const relativeFormat = new Intl.RelativeTimeFormat("en");

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 60 * 60],
  ["month", 30 * 24 * 60 * 60],
  ["week", 7 * 24 * 60 * 60],
  ["day", 24 * 60 * 60],
  ["hour", 60 * 60],
  ["minute", 60],
];

const SHORT_UNITS: [string, number][] = [
  ["y", 365 * 24 * 60 * 60],
  ["mo", 30 * 24 * 60 * 60],
  ["w", 7 * 24 * 60 * 60],
  ["d", 24 * 60 * 60],
  ["h", 60 * 60],
  ["m", 60],
];

/** "6h ago", for cards where "6 hours ago" won't fit. */
export function formatRelativeShort(date: Date, now: Date) {
  const seconds = (now.getTime() - date.getTime()) / 1000;
  const unit = SHORT_UNITS.find(([, size]) => seconds >= size);
  return unit ? `${Math.floor(seconds / unit[1])}${unit[0]} ago` : "just now";
}

export function formatRelative(date: Date, now: Date) {
  const seconds = (now.getTime() - date.getTime()) / 1000;

  for (const [unit, size] of UNITS) {
    if (seconds >= size) {
      return relativeFormat.format(-Math.floor(seconds / size), unit);
    }
  }
  return "just now";
}
