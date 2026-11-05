import type { SceneKind } from "@/lib/format";

/** The same cleaning as search_clean() in Postgres, so "Bear’dion" finds "Beardion". */
export const cleanText = (text: string) => text.replace(/['’]/g, "").toLowerCase();

/** Letters and digits only: nothing else ever reaches a tsquery. */
export const lexemes = (text: string) => cleanText(text).match(/[\p{L}\p{N}]+/gu) ?? [];

const KINDS: Record<string, SceneKind> = {
  prologue: "prologue",
  scene: "scene",
  outro: "outro",
  postcredit: "post_credit",
  "post-credit": "post_credit",
  post_credit: "post_credit",
};

export type ParsedQuery = {
  /** Words, typo-tolerant and matched as prefixes. */
  terms: string[][];
  /** Quoted text, matched exactly and in order. */
  phrases: string[][];
  excludes: string[][];
  speakers: string[];
  kinds: SceneKind[];
  episodes: { from: number; to: number } | null;
};

const TOKEN = /(-?)(?:([a-z]+):)?(?:"([^"]*)"?|(\S+))/gi;

function parseEpisodes(value: string) {
  const match = value.match(/^(\d+)(?:-(\d+))?$/);
  return match ? { from: Number(match[1]), to: Number(match[2] ?? match[1]) } : null;
}

export function parseQuery(input: string): ParsedQuery {
  const parsed: ParsedQuery = { terms: [], phrases: [], excludes: [], speakers: [], kinds: [], episodes: null };

  for (const [whole, minus, prefix, quoted, word] of input.matchAll(TOKEN)) {
    const value = quoted ?? word ?? "";
    const field = prefix?.toLowerCase();

    if (field === "speaker" && value) {
      parsed.speakers.push(cleanText(value));
    } else if (field === "kind" && KINDS[value.toLowerCase()]) {
      parsed.kinds.push(KINDS[value.toLowerCase()]);
    } else if ((field === "episode" || field === "ep") && parseEpisodes(value)) {
      parsed.episodes = parseEpisodes(value);
    } else {
      // An unknown "word:" is ordinary text, so "Slayers: Part 2" still searches.
      const words = lexemes(prefix ? `${prefix} ${value}` : value);
      if (words.length === 0) continue;

      if (minus) parsed.excludes.push(words);
      else if (quoted !== undefined || whole.includes('"')) parsed.phrases.push(words);
      else parsed.terms.push(words);
    }
  }

  return parsed;
}

export const hasText = ({ terms, phrases }: ParsedQuery) => terms.length > 0 || phrases.length > 0;

export const hasSceneFilter = ({ speakers, kinds, episodes }: ParsedQuery) =>
  speakers.length > 0 || kinds.length > 0 || episodes !== null;

export const isEmptyQuery = (parsed: ParsedQuery) => !hasText(parsed) && !hasSceneFilter(parsed);

/** 'ash' <-> 'force', with the last word a prefix unless it must match exactly. */
export const toTsQuery = (words: string[], asPrefix: boolean) =>
  words.map((word) => `'${word}'`).join(" <-> ") + (asPrefix ? ":*" : "");

/** "Go to episode 12", "episode 12", "ep 12". */
export function episodeJump(input: string) {
  const match = input.trim().match(/^(?:go to )?(?:episode|ep\.?)\s*(\d+)$/i);
  return match ? Number(match[1]) : null;
}
