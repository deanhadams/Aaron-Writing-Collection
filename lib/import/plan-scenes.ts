import type { Beat } from "@/lib/db/schema";
import type { ParsedScene } from "./parse-script";

export type ExistingScene = Omit<ParsedScene, "beats"> & {
  id: string;
  beats: Beat[];
  version: number;
};

export type SceneAction =
  | { action: "insert"; scene: ParsedScene }
  | { action: "update"; scene: ParsedScene; existing: ExistingScene; version: number }
  | { action: "unchanged"; existing: ExistingScene }
  | { action: "protected"; scene: ParsedScene; existing: ExistingScene };

// Beat ids differ on every parse, and jsonb reorders keys, so compare by field.
const beatContent = ({ type, character, parenthetical, text }: Beat) => [
  type,
  character ?? null,
  parenthetical ?? null,
  text,
];

const sceneContent = ({ kind, title, timecode, location, beats }: Omit<ParsedScene, "position">) =>
  JSON.stringify([kind, title, timecode, location, beats.map(beatContent)]);

/** Matches by position within an episode. Scenes edited on the site need force. */
export function planScenes(
  existing: ExistingScene[],
  parsed: ParsedScene[],
  force: boolean,
): SceneAction[] {
  const byPosition = new Map(existing.map((scene) => [scene.position, scene]));

  return parsed.map((scene) => {
    const match = byPosition.get(scene.position);
    if (!match) return { action: "insert", scene };
    if (sceneContent(match) === sceneContent(scene)) return { action: "unchanged", existing: match };

    const isEdited = match.version > 1;
    if (isEdited && !force) return { action: "protected", scene, existing: match };

    // A forced overwrite moves the version on, so an open editor sees a conflict.
    return { action: "update", scene, existing: match, version: isEdited ? match.version + 1 : 1 };
  });
}

/** Scenes in the database past the end of the document. They are never deleted. */
export function extraScenes(existing: ExistingScene[], parsed: ParsedScene[]) {
  const positions = new Set(parsed.map(({ position }) => position));
  return existing.filter(({ position }) => !positions.has(position));
}
