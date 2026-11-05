import type { Beat } from "@/lib/db/schema";
import { spokenText } from "@/lib/script/format";
import { cleanText, type ParsedQuery } from "./query";

export type Segment = { text: string; isMatch: boolean };

const WORD = /[\p{L}\p{N}'’]+/gu;

function editDistance(a: string, b: string) {
  let row = Array.from({ length: b.length + 1 }, (_, index) => index);

  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) {
      next[j] = Math.min(row[j] + 1, next[j - 1] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    row = next;
  }
  return row[b.length];
}

/** A word matches a search term if it starts with it, or is one slip away. */
function wordMatches(word: string, term: string) {
  if (word.startsWith(term)) return true;
  if (term.length < 4) return false;
  return editDistance(word.slice(0, term.length + 1), term) <= (term.length >= 8 ? 2 : 1);
}

type Word = { start: number; end: number; clean: string };

const wordsIn = (text: string): Word[] =>
  [...text.matchAll(WORD)].map((match) => ({
    start: match.index,
    end: match.index + match[0].length,
    clean: cleanText(match[0]),
  }));

/** Marks every word that matched, keeping the text exactly as written. */
export function highlight(text: string, query: Pick<ParsedQuery, "terms" | "phrases">): Segment[] {
  const words = wordsIn(text);
  const marked = new Set<number>();

  const markRun = (run: string[], fuzzy: boolean) => {
    words.forEach((_, start) => {
      const isRun = run.every((part, offset) => {
        const word = words[start + offset]?.clean;
        return word !== undefined && (fuzzy ? wordMatches(word, part) : word === part);
      });
      if (isRun) run.forEach((__, offset) => marked.add(start + offset));
    });
  };

  query.terms.forEach((term) => markRun(term, true));
  query.phrases.forEach((phrase) => markRun(phrase, false));

  const segments: Segment[] = [];
  let cursor = 0;
  words.forEach(({ start, end }, index) => {
    if (!marked.has(index)) return;
    if (start > cursor) segments.push({ text: text.slice(cursor, start), isMatch: false });
    segments.push({ text: text.slice(start, end), isMatch: true });
    cursor = end;
  });
  if (cursor < text.length || segments.length === 0) segments.push({ text: text.slice(cursor), isMatch: false });
  return segments;
}

export const matchCount = (segments: Segment[]) => segments.filter(({ isMatch }) => isMatch).length;

export type BeatSnippet = {
  beatId: string;
  speaker: string | null;
  parenthetical: string | null;
  type: Beat["type"];
  segments: Segment[];
};

const LEAD = 28;
const LENGTH = 180;

/** Keeps a long line short, with the first match near the start, where a narrow row shows it. */
function trimAround(segments: Segment[]): Segment[] {
  const total = segments.reduce((sum, { text }) => sum + text.length, 0);

  let offset = 0;
  const firstMatch = segments.findIndex(({ isMatch }) => isMatch);
  segments.slice(0, Math.max(firstMatch, 0)).forEach(({ text }) => (offset += text.length));

  if (total <= LENGTH && offset <= LEAD * 2) return segments;

  const start = offset > LEAD * 2 ? offset - LEAD : 0;
  const end = start + LENGTH;
  const trimmed: Segment[] = [];
  let position = 0;

  for (const { text, isMatch } of segments) {
    const from = Math.max(start, position);
    const to = Math.min(end, position + text.length);
    if (from < to) trimmed.push({ text: text.slice(from - position, to - position), isMatch });
    position += text.length;
  }

  if (start > 0) trimmed.unshift({ text: "…", isMatch: false });
  if (end < total) trimmed.push({ text: "…", isMatch: false });
  return trimmed;
}

const isBySpeaker = (beat: Beat, speakers: string[]) =>
  speakers.length === 0 || speakers.some((name) => cleanText(beat.character ?? "").includes(name));

/** The line that best matches, by a speaker asked for when there is one. */
export function bestBeat(beats: Beat[], query: ParsedQuery): BeatSnippet | null {
  const spokenFirst = beats.filter((beat) => isBySpeaker(beat, query.speakers));
  const candidates = spokenFirst.length > 0 ? spokenFirst : beats;

  let best: { beat: Beat; segments: Segment[]; score: number } | null = null;

  for (const beat of candidates) {
    const { speaker, parenthetical } = spokenText(beat);
    const score = matchCount(highlight(`${speaker ?? ""} ${parenthetical ?? ""} ${beat.text}`, query));
    if (!best || score > best.score) best = { beat, score, segments: highlight(beat.text, query) };
  }

  if (!best) return null;
  const { speaker, parenthetical } = spokenText(best.beat);
  const isSpoken = best.beat.type === "dialogue" || best.beat.type === "vo";

  return {
    beatId: best.beat.id,
    type: best.beat.type,
    speaker: isSpoken ? speaker : null,
    parenthetical: isSpoken ? parenthetical : null,
    segments: trimAround(best.segments),
  };
}
