import type { SceneKind } from "@/lib/format";

export type Timed = { timecode: string | null; rest: string };

export type Heading =
  | { type: "season"; number: number }
  | { type: "episode"; number: number; title: string }
  | { type: "scene"; kind: SceneKind; title: string | null; timecode: string | null; location: string | null }
  | { type: "theme"; which: "opening" | "outro"; value: string | null; timecode: string | null }
  | { type: "end" };

const EDGE_DECOR = /^[\p{Extended_Pictographic}\p{Regional_Indicator}\u{1F3FB}-\u{1F3FF}️‍\s]+|[\p{Extended_Pictographic}\p{Regional_Indicator}\u{1F3FB}-\u{1F3FF}️‍\s]+$/gu;

const TIME = String.raw`\d{1,2}(?::\d{2}){1,2}`;
const DASH = "[-–—]";
const LEADING_TIME = new RegExp(`^\\(\\s*(${TIME})(?:\\s*${DASH}\\s*(${TIME}|END))?\\s*\\)\\s*(.*)$`, "u");
const TRAILING_TIME = new RegExp(`^(.*?)\\s*\\(\\s*(${TIME})(?:\\s*${DASH}\\s*(${TIME}|END))?\\s*\\)$`, "u");

const SEASON = /^SEASON\s+(\d+)$/i;
const EPISODE = new RegExp(`^EPISODE\\s+(\\d+)(?:\\s*(?::|${DASH})\\s*(.*))?$`, "iu");
const SCENE = new RegExp(`^Scene\\s+\\d+(?:\\s*(?::|${DASH})\\s*(.*))?$`, "iu");
const END_EPISODE = /^END(?: OF)? EPISODE\.?(?: SEASON FINALE\.?)?$/i;
const BARE_END = /^END\.?$/i;
const IN_BRACKETS = /^\((.*)\)$/;

type Special =
  | { names: RegExp; kind: SceneKind; title?: (rest: string | null) => string | null }
  | { names: RegExp; theme: "opening" | "outro" };

const SPECIALS: Special[] = [
  { names: /^(?:prologue|opening scene)/i, kind: "prologue" },
  { names: /^(?:end scene|post[- ]credits?(?: scene)?)/i, kind: "post_credit" },
  // A one-off in Episode 16: a closing scene that sits inside the episode.
  { names: /^ending(?=\s*:)/i, kind: "scene", title: (rest) => `Ending: ${rest}` },
  { names: /^opening theme/i, theme: "opening" },
  { names: /^(?:episode )?outro/i, theme: "outro" },
];

const formatTime = (start: string, end?: string) => (end ? `${start} - ${end}` : start);

/** "(2:00 - 6:00) CLASSROOM - DAY" into its timecode and whatever follows. */
export function splitTimecode(text: string): Timed {
  const match = text.match(LEADING_TIME);
  return match
    ? { timecode: formatTime(match[1], match[2]), rest: match[3].trim() }
    : { timecode: null, rest: text };
}

function stripDecor(text: string) {
  return text.replace(EDGE_DECOR, "");
}

/** The text after a block name, or undefined if the line only starts with those words. */
function afterName(text: string, names: RegExp) {
  const match = text.match(names);
  if (!match) return undefined;

  const rest = text.slice(match[0].length).trim();
  if (!rest) return null;
  const separated = rest.match(new RegExp(`^(?::|${DASH})\\s*(.*)$`, "u"));
  if (separated) return separated[1].trim() || null;
  return rest.startsWith("(") ? rest : undefined;
}

function parseSpecial(text: string, leading: string | null): Heading | null {
  const trailing = leading ? null : text.match(TRAILING_TIME);
  const body = trailing ? trailing[1] : text;
  const timecode = leading ?? (trailing ? formatTime(trailing[2], trailing[3]) : null);

  for (const special of SPECIALS) {
    const rest = afterName(body, special.names);
    if (rest === undefined) continue;

    if ("theme" in special) {
      return { type: "theme", which: special.theme, value: rest, timecode };
    }
    const title = special.title ? special.title(rest) : (rest?.replace(IN_BRACKETS, "$1") ?? null);
    return { type: "scene", kind: special.kind, title, timecode, location: null };
  }
  return null;
}

/** Headings match the whole line, so a sentence that merely mentions one stays a beat. */
export function parseHeading(raw: string): Heading | null {
  const text = stripDecor(raw);

  const season = text.match(SEASON);
  if (season) return { type: "season", number: Number(season[1]) };

  const episode = text.match(EPISODE);
  if (episode) {
    const number = Number(episode[1]);
    return { type: "episode", number, title: episode[2]?.trim() || `Episode ${number}` };
  }

  const scene = text.match(SCENE);
  if (scene) {
    return { type: "scene", kind: "scene", title: scene[1]?.trim() || null, timecode: null, location: null };
  }

  const { timecode, rest } = splitTimecode(text);
  if (END_EPISODE.test(rest) || (timecode && BARE_END.test(rest))) return { type: "end" };
  return parseSpecial(rest, timecode);
}
