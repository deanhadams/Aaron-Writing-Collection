import type { Beat } from "@/lib/db/schema";
import { sceneImportKey } from "./import-key";
import type { ParsedScene } from "./parse-script";

export type ExistingScene = Omit<ParsedScene, "beats"> & {
  id: string;
  beats: Beat[];
  version: number;
  importKey: string | null;
  deletedAt: Date | null;
};

export type SceneAction =
  | { action: "insert"; scene: ParsedScene; importKey: string }
  | { action: "update"; scene: ParsedScene; existing: ExistingScene; version: number }
  | { action: "unchanged"; existing: ExistingScene }
  | { action: "protected"; scene: ParsedScene; existing: ExistingScene }
  | { action: "deleted"; existing: ExistingScene };

// Beat ids differ on every parse, and jsonb reorders keys, so compare by field.
const beatContent = ({ type, character, parenthetical, text }: Beat) => [
  type,
  character ?? null,
  parenthetical ?? null,
  text,
];

const sceneContent = ({ kind, title, timecode, location, beats }: Omit<ParsedScene, "position">) =>
  JSON.stringify([kind, title, timecode, location, beats.map(beatContent)]);

/**
 * Matches by import key across the season, so a scene dragged or moved on the
 * site is still found. Its place is the site's: nothing here writes a position
 * or an episode to a scene that already exists. Scenes edited on the site need
 * force, and a scene someone deleted stays deleted.
 */
export function planScenes(
  existing: ExistingScene[],
  parsed: ParsedScene[],
  episodeNumber: number,
  force: boolean,
): SceneAction[] {
  const byKey = new Map(existing.flatMap((scene) => (scene.importKey ? [[scene.importKey, scene] as const] : [])));

  return parsed.map((scene) => {
    const importKey = sceneImportKey(episodeNumber, scene.position);
    const match = byKey.get(importKey);
    if (!match) return { action: "insert", scene, importKey };
    if (match.deletedAt) return { action: "deleted", existing: match };
    if (sceneContent(match) === sceneContent(scene)) return { action: "unchanged", existing: match };

    const isEdited = match.version > 1;
    if (isEdited && !force) return { action: "protected", scene, existing: match };

    // A forced overwrite moves the version on, so an open editor sees a conflict.
    return { action: "update", scene, existing: match, version: isEdited ? match.version + 1 : 1 };
  });
}

/** Live scenes from an earlier import that the document no longer has. They are never deleted. */
export function extraScenes(existing: ExistingScene[], documentKeys: Set<string>) {
  return existing.filter(({ importKey, deletedAt }) => importKey && !deletedAt && !documentKeys.has(importKey));
}
