import type { Beat } from "@/lib/db/schema";
import { splitSpeakers } from "@/lib/script/scene-summary";
import type { SourceLine } from "./source-lines";

/** Capitalised labels that look like speakers but are not characters. */
export const NON_SPEAKERS = new Set([
  "SOUND",
  "VISUAL",
  "EXPLOSION",
  "ROAR",
  "SLAM",
  "SHIFTS",
  "THE 2015 FIGHT",
]);

/** Voices that speak as vo beats under a label, with no character card. */
export const VOICE_LABELS = new Set(["INTERCOM"]);

const LABELLED = /^(?:\((VISUAL|SOUND|ACTION|NOTE|DIALOGUE|VO)\)|(VISUAL|SOUND|ACTION))\s*:\s*(.*)$/u;
const LABEL_IN_BRACKETS = /^\((VISUAL|SOUND|ACTION):\s*(.*)$/u;
const SPEAKER = /^([\p{Lu}\p{N}][\p{Lu}\p{N} .,'’&/-]*?)\s*(?:\(([^()]*)\))?\s*:\s*(.*)$/u;
const VOICE_OVER = /^V\.?\s?O\.?$/;
const STAGE_TAG = /^(O\.?S\.?|OFF[- ]?SCREEN|CONT['’]?D)$/;
const RANK_ROW = /^RANK \d+$/;
const LEVEL_ROW = /^Level \d+$/;
const CODE_NAME = /^\d{4}$/;
const MAX_NAME_WORDS = 4;

function isSpeakerName(name: string) {
  if (CODE_NAME.test(name)) return true;
  const letters = name.match(/\p{Lu}/gu)?.length ?? 0;
  return letters >= 2 && name.split(/\s+/).length <= MAX_NAME_WORDS;
}

function canSpeak(name: string) {
  return (
    !NON_SPEAKERS.has(name) &&
    !RANK_ROW.test(name) &&
    splitSpeakers(name).every(isSpeakerName)
  );
}

/** Splits "(Looks up) Text" into its parenthetical and the rest. Brackets may nest. */
export function splitParenthetical(text: string): { parenthetical?: string; text: string } {
  if (!text.startsWith("(")) return { text };

  let open = 0;
  for (const [index, char] of [...text].entries()) {
    if (char === "(") open++;
    if (char === ")" && --open === 0) {
      return {
        parenthetical: text.slice(1, index).trim(),
        text: text.slice(index + 1).trim(),
      };
    }
  }
  return { text };
}

type Spoken = Pick<Beat, "type" | "character" | "parenthetical" | "text">;

function parseSpoken(line: string): Spoken | null {
  const match = line.match(SPEAKER);
  if (!match) return null;

  const [, rawName, tag, rest] = match;
  const name = rawName.trim();
  const trimmedTag = tag?.trim();
  const isTagCaps = trimmedTag !== undefined && !/\p{Ll}/u.test(trimmedTag);
  const isVoiceName = VOICE_OVER.test(name);
  const isVoiceTag = trimmedTag !== undefined && VOICE_OVER.test(trimmedTag);

  if (!isVoiceName && !canSpeak(name)) return null;

  // "V.O. (MARA):" names a speaker; "V.O. (Unrecognizable Voice):" describes one.
  let character: string | undefined;
  let tagNote: string | undefined;
  if (isVoiceName) {
    if (isTagCaps) character = trimmedTag;
    else tagNote = trimmedTag;
  } else if (isVoiceTag || trimmedTag === undefined) {
    character = name;
  } else if (isTagCaps && !STAGE_TAG.test(trimmedTag)) {
    character = `${name} (${trimmedTag})`;
  } else {
    character = name;
    tagNote = trimmedTag;
  }

  const body = splitParenthetical(rest);
  const parenthetical = [tagNote, body.parenthetical].filter(Boolean).join("; ");

  return {
    type: isVoiceName || isVoiceTag || VOICE_LABELS.has(name) ? "vo" : "dialogue",
    ...(character && { character }),
    ...(parenthetical && { parenthetical }),
    text: body.text,
  };
}

// The last three are the Word export's, for a beat a plain line would misread.
const LABEL_TYPES = {
  VISUAL: "visual",
  SOUND: "sound",
  ACTION: "action",
  NOTE: "note",
  DIALOGUE: "dialogue",
  VO: "vo",
} as const;
type Label = keyof typeof LABEL_TYPES;

export function parseBeat(line: SourceLine, createId: () => string): Beat {
  const labelled = line.text.match(LABELLED);
  if (labelled) {
    return {
      id: createId(),
      type: LABEL_TYPES[(labelled[1] ?? labelled[2]) as Label],
      text: labelled[3],
    };
  }

  // "(VISUAL: SPLIT SCREEN) Both..." loses only the label word, so the
  // bracket stays closed: "(SPLIT SCREEN) Both...".
  const bracketed = line.text.match(LABEL_IN_BRACKETS);
  if (bracketed) {
    return {
      id: createId(),
      type: LABEL_TYPES[bracketed[1] as Label],
      text: `(${bracketed[2]}`,
    };
  }

  // Indented "TYLER: Level 6" rows are a roster, not a line anyone says.
  const spoken = parseSpoken(line.text);
  if (spoken && !(line.depth > 0 && LEVEL_ROW.test(spoken.text))) {
    return { id: createId(), ...spoken };
  }

  return {
    id: createId(),
    type: line.depth > 0 ? "action" : "note",
    text: line.text,
  };
}
