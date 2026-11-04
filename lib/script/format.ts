import type { Beat } from "@/lib/db/schema";
import type { SceneKind } from "@/lib/format";
import { VOICE_LABELS } from "@/lib/import/parse-beat";

/** The wording the reader and the Word export share, so the two cannot drift apart. */

type SceneHead = { kind: SceneKind; title: string | null };

/** The heading as the source document writes it. The number counts regular scenes only. */
export function sceneHeading({ kind, title }: SceneHead, number: number | null) {
  switch (kind) {
    case "scene":
      return title ? `Scene ${number}: ${title}` : `Scene ${number}`;
    case "prologue":
      return title ? `Prologue: ${title}` : "Prologue";
    case "post_credit":
      return title ? `End Scene (${title})` : "End Scene";
    case "outro":
      return title ? `Outro Scene: ${title}` : "Outro Scene";
  }
}

/** Numbers regular scenes in order. Prologues and outros are not numbered in the script. */
export function sceneNumbers(scenes: { kind: SceneKind }[]) {
  let count = 0;
  return scenes.map(({ kind }) => (kind === "scene" ? ++count : null));
}

export type BeatText = {
  /** Bold, before the text: "DESRUC" or "V.O. (Unrecognizable Voice)". */
  speaker: string | null;
  parenthetical: string | null;
  text: string;
};

/** "V.O. (MARA):" would read as a name, so a tag needs lower case to stay a description. */
const isVoiceDescription = (text: string | undefined) => !!text && /\p{Ll}/u.test(text) && !/[()]/.test(text);

export function spokenText({ type, character, parenthetical, text }: Beat): BeatText {
  const name = character?.trim().toUpperCase();
  const aside = parenthetical?.trim() || null;

  if (type !== "vo") return { speaker: name ?? null, parenthetical: aside, text };
  if (name && VOICE_LABELS.has(name)) return { speaker: name, parenthetical: aside, text };
  if (name) return { speaker: `${name} (V.O.)`, parenthetical: aside, text };

  return isVoiceDescription(aside ?? undefined)
    ? { speaker: `V.O. (${aside})`, parenthetical: null, text }
    : { speaker: "V.O.", parenthetical: aside, text };
}

export const episodePageName = ({ number }: { number: number }) => `episode-${number}`;

/** The episode's title in the margin of its printed pages. Escaped: a title is free text. */
export function episodePageRule(episode: { number: number; title: string }) {
  const label = `Episode ${episode.number}: ${episode.title}`.replace(/[\\"]/g, "\\$&").replace(/</g, "\\3C ");
  return `@page ${episodePageName(episode)} { @top-center { content: "${label}"; } }`;
}

/** Editor text can hold line breaks, but one beat is one line in the script. */
export const oneLine = (text: string) => text.replace(/\s*\n\s*/g, " ").trim();
