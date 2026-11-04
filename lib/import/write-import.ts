import { and, eq, inArray } from "drizzle-orm";
import type { db } from "@/lib/db";
import {
  characters,
  episodes,
  sceneCharacters,
  sceneRevisions,
  scenes,
  seasons,
  series,
} from "@/lib/db/schema";
import { speakerLineCounts } from "@/lib/script/scene-summary";
import type { SeedCharacter } from "./characters";
import type { ParsedEpisode, ParsedScript } from "./parse-script";
import { extraScenes, planScenes, type SceneAction } from "./plan-scenes";

export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export const SERIES_TITLE = "Devil Bunny";
export const SAMPLE_SERIES_TITLE = "Sample Series";

export type ImportOptions = {
  force: boolean;
  removeSample: boolean;
  seriesTitle?: string;
};

export type ImportResult = {
  seriesId: string;
  seasonId: string;
  episodesCreated: number;
  episodesUpdated: number;
  scenesInserted: number;
  scenesUpdated: number;
  scenesUnchanged: number;
  scenesProtected: string[];
  scenesExtra: string[];
  charactersCreated: number;
  sceneCharacterRows: number;
};

async function findOrCreateSeries(tx: Transaction, title: string) {
  const [found] = await tx.select({ id: series.id }).from(series).where(eq(series.title, title)).limit(1);
  if (found) return found.id;

  const [created] = await tx.insert(series).values({ title }).returning({ id: series.id });
  return created.id;
}

// The title stays empty: seasonTitle() already shows "Season 1".
async function findOrCreateSeason(tx: Transaction, seriesId: string, number: number) {
  const [found] = await tx
    .select({ id: seasons.id })
    .from(seasons)
    .where(and(eq(seasons.seriesId, seriesId), eq(seasons.number, number)))
    .limit(1);
  if (found) return found.id;

  const [created] = await tx.insert(seasons).values({ seriesId, number }).returning({ id: seasons.id });
  return created.id;
}

// Existing characters keep their colors and text, which belong to the site.
async function syncCharacters(tx: Transaction, seriesId: string, cast: SeedCharacter[]) {
  const existing = await tx.select().from(characters).where(eq(characters.seriesId, seriesId));
  const byName = new Map(existing.map((character) => [character.name.toUpperCase(), character]));
  const missing = cast.filter(({ name }) => !byName.has(name));

  if (missing.length > 0) {
    await tx.insert(characters).values(
      missing.map(({ name, fullName, color, portraitKey }) => ({
        seriesId,
        name,
        fullName,
        color,
        portraitKey,
      })),
    );
  }

  for (const { name, fullName, portraitKey } of cast) {
    const found = byName.get(name);
    if (found && (!found.fullName || !found.portraitKey)) {
      await tx
        .update(characters)
        .set({ fullName: found.fullName ?? fullName, portraitKey: found.portraitKey ?? portraitKey })
        .where(eq(characters.id, found.id));
    }
  }

  return missing.length;
}

async function syncEpisode(tx: Transaction, seasonId: string, episode: ParsedEpisode) {
  const { number, title, openingTheme, outroTheme } = episode;
  const [found] = await tx
    .select()
    .from(episodes)
    .where(and(eq(episodes.seasonId, seasonId), eq(episodes.number, number)))
    .limit(1);

  if (!found) {
    const [created] = await tx
      .insert(episodes)
      .values({ seasonId, number, title, openingTheme, outroTheme, status: "drafting" })
      .returning({ id: episodes.id });
    return { id: created.id, state: "created" as const };
  }

  // Status belongs to the site, so a re-run leaves it alone.
  const isSame =
    found.title === title &&
    found.openingTheme === openingTheme &&
    found.outroTheme === outroTheme;
  if (isSame) return { id: found.id, state: "unchanged" as const };

  await tx.update(episodes).set({ title, openingTheme, outroTheme }).where(eq(episodes.id, found.id));
  return { id: found.id, state: "updated" as const };
}

async function applySceneAction(tx: Transaction, episodeId: string, item: SceneAction) {
  if (item.action === "insert") {
    await tx.insert(scenes).values({ ...item.scene, episodeId, version: 1 });
  }

  if (item.action === "update") {
    const { existing, scene, version } = item;
    await tx.insert(sceneRevisions).values({ sceneId: existing.id, beats: existing.beats });
    await tx
      .update(scenes)
      .set({
        kind: scene.kind,
        title: scene.title,
        timecode: scene.timecode,
        location: scene.location,
        beats: scene.beats,
        version,
        // Only overwriting an edited scene counts as an edit: "Continue
        // writing" follows updated_at, and a re-import is nobody's place.
        ...(existing.version > 1 && { updatedBy: null, updatedAt: new Date() }),
      })
      .where(eq(scenes.id, existing.id));
  }
}

async function rebuildSceneCharacters(tx: Transaction, seasonId: string, seriesId: string) {
  const rows = await tx
    .select({ id: scenes.id, beats: scenes.beats })
    .from(scenes)
    .innerJoin(episodes, eq(scenes.episodeId, episodes.id))
    .where(eq(episodes.seasonId, seasonId));
  if (rows.length === 0) return 0;

  const cast = await tx
    .select({ id: characters.id, name: characters.name })
    .from(characters)
    .where(eq(characters.seriesId, seriesId));
  const ids = new Map(cast.map(({ id, name }) => [name.toUpperCase(), id]));

  const links = rows.flatMap(({ id: sceneId, beats }) =>
    [...speakerLineCounts(beats)].flatMap(([name, lineCount]) => {
      const characterId = ids.get(name);
      return characterId ? [{ sceneId, characterId, lineCount }] : [];
    }),
  );

  await tx.delete(sceneCharacters).where(inArray(sceneCharacters.sceneId, rows.map(({ id }) => id)));
  if (links.length > 0) await tx.insert(sceneCharacters).values(links);
  return links.length;
}

/** Runs inside the caller's transaction, so any failure leaves the database as it was. */
export async function writeImport(
  tx: Transaction,
  script: ParsedScript,
  cast: SeedCharacter[],
  options: ImportOptions,
): Promise<ImportResult> {
  if (script.seasonNumber === null) throw new Error("No SEASON heading found");

  if (options.removeSample) {
    await tx.delete(series).where(eq(series.title, SAMPLE_SERIES_TITLE));
  }

  const seriesId = await findOrCreateSeries(tx, options.seriesTitle ?? SERIES_TITLE);
  const seasonId = await findOrCreateSeason(tx, seriesId, script.seasonNumber);

  const result: ImportResult = {
    seriesId,
    seasonId,
    episodesCreated: 0,
    episodesUpdated: 0,
    scenesInserted: 0,
    scenesUpdated: 0,
    scenesUnchanged: 0,
    scenesProtected: [],
    scenesExtra: [],
    charactersCreated: await syncCharacters(tx, seriesId, cast),
    sceneCharacterRows: 0,
  };

  for (const episode of script.episodes) {
    const { id: episodeId, state } = await syncEpisode(tx, seasonId, episode);
    if (state === "created") result.episodesCreated++;
    if (state === "updated") result.episodesUpdated++;

    const existing = await tx.select().from(scenes).where(eq(scenes.episodeId, episodeId));

    for (const item of planScenes(existing, episode.scenes, options.force)) {
      await applySceneAction(tx, episodeId, item);
      if (item.action === "insert") result.scenesInserted++;
      if (item.action === "update") result.scenesUpdated++;
      if (item.action === "unchanged") result.scenesUnchanged++;
      if (item.action === "protected") {
        result.scenesProtected.push(`Episode ${episode.number}, position ${item.existing.position} (v${item.existing.version})`);
      }
    }

    for (const extra of extraScenes(existing, episode.scenes)) {
      result.scenesExtra.push(`Episode ${episode.number}, position ${extra.position}`);
    }
  }

  result.sceneCharacterRows = await rebuildSceneCharacters(tx, seasonId, seriesId);
  return result;
}
