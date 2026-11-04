import { eq, inArray } from "drizzle-orm";
import { characters, sceneCharacters, type Beat } from "@/lib/db/schema";
import { speakerLineCounts } from "@/lib/script/scene-summary";
import type { Transaction } from "./save-scene";

type CastRow = { id: string; name: string; aliases: string[] };

/** Every name a script can use for a card, in capitals. */
export const castIds = (cast: CastRow[]) =>
  new Map(
    cast.flatMap(({ id, name, aliases }) =>
      [name.toUpperCase(), ...aliases].map((key) => [key, id] as const),
    ),
  );

// Names with no character row, like INTERCOM, simply get no link. A name and
// its alias in one scene are one character, so their lines add up.
export function sceneLinks(sceneId: string, beats: Beat[], ids: Map<string, string>) {
  const lineCounts = new Map<string, number>();
  for (const [name, count] of speakerLineCounts(beats)) {
    const characterId = ids.get(name);
    if (characterId) lineCounts.set(characterId, (lineCounts.get(characterId) ?? 0) + count);
  }
  return [...lineCounts].map(([characterId, lineCount]) => ({ sceneId, characterId, lineCount }));
}

/** Pass live scenes only: a deleted scene has no rows until it is restored. */
export async function rebuildSceneLinks(
  tx: Transaction,
  seriesId: string,
  rows: { id: string; beats: Beat[] }[],
) {
  if (rows.length === 0) return 0;

  const cast = await tx
    .select({ id: characters.id, name: characters.name, aliases: characters.aliases })
    .from(characters)
    .where(eq(characters.seriesId, seriesId));
  const ids = castIds(cast);
  const links = rows.flatMap(({ id, beats }) => sceneLinks(id, beats, ids));

  await tx.delete(sceneCharacters).where(inArray(sceneCharacters.sceneId, rows.map(({ id }) => id)));
  if (links.length > 0) await tx.insert(sceneCharacters).values(links);
  return links.length;
}
