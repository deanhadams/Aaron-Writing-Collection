import { and, eq, sql } from "drizzle-orm";
import { liveEpisode, liveScene } from "@/lib/db/live";
import {
  characters,
  episodes,
  sceneRevisions,
  scenes,
  seasons,
  series,
} from "@/lib/db/schema";
import { slugify, uniqueSlug } from "@/lib/characters/slug";
import type { Transaction } from "@/lib/scenes/save-scene";
import { rebuildSceneLinks } from "@/lib/scenes/scene-links";
import type { SeedCharacter } from "./characters";
import { episodeImportKey, sceneImportKey } from "./import-key";
import type { ParsedEpisode, ParsedScript } from "./parse-script";
import { extraScenes, planScenes, type ExistingScene, type SceneAction } from "./plan-scenes";

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
  /** Changed in the document, but edited on the site. Force overwrites them. */
  episodesProtected: string[];
  /** Deleted on the site, so left deleted along with their scenes. */
  episodesDeleted: string[];
  /** New episodes whose number was taken on the site. */
  episodesRenumbered: string[];
  scenesInserted: number;
  scenesUpdated: number;
  scenesUnchanged: number;
  scenesProtected: string[];
  scenesExtra: string[];
  /** Deleted on the site, so left deleted. */
  scenesDeleted: string[];
  charactersCreated: number;
  /** Speakers that matched a card by alias, so no card was created for them. */
  charactersMatchedByAlias: string[];
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

// Existing characters keep their colors and text, which belong to the site. An
// alias is a card's old or merged name, so it must not bring that card back.
async function syncCharacters(tx: Transaction, seriesId: string, cast: SeedCharacter[]) {
  const existing = await tx.select().from(characters).where(eq(characters.seriesId, seriesId));
  const byName = new Map(existing.map((character) => [character.name.toUpperCase(), character]));
  const aliases = new Set(existing.flatMap((character) => character.aliases));
  const matchedByAlias = cast.filter(({ name }) => !byName.has(name) && aliases.has(name)).map(({ name }) => name);
  const missing = cast.filter(({ name }) => !byName.has(name) && !aliases.has(name));

  const taken = new Set((await tx.select({ slug: characters.slug }).from(characters)).map(({ slug }) => slug));
  for (const { name, fullName, color, portraitKey } of missing) {
    const slug = uniqueSlug(slugify(fullName ?? name), taken);
    taken.add(slug);
    await tx.insert(characters).values({ seriesId, name, fullName, slug, color, portraitKey });
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

  return { created: missing.length, matchedByAlias };
}

// A number the site is using stays with that episode, not with the document.
async function freeNumber(tx: Transaction, seasonId: string, wanted: number) {
  const rows = await tx
    .select({ number: episodes.number })
    .from(episodes)
    .where(and(eq(episodes.seasonId, seasonId), liveEpisode));
  const used = rows.map(({ number }) => number);
  return used.includes(wanted) ? Math.max(...used) + 1 : wanted;
}

async function syncEpisode(tx: Transaction, seasonId: string, episode: ParsedEpisode, force: boolean) {
  const { title, openingTheme, outroTheme } = episode;
  const importKey = episodeImportKey(episode.number);
  const [found] = await tx
    .select()
    .from(episodes)
    .where(and(eq(episodes.seasonId, seasonId), eq(episodes.importKey, importKey)))
    .limit(1);

  if (!found) {
    const number = await freeNumber(tx, seasonId, episode.number);
    const [created] = await tx
      .insert(episodes)
      .values({ seasonId, number, title, openingTheme, outroTheme, status: "drafting", importKey })
      .returning({ id: episodes.id });
    await tx.update(seasons).set({ version: sql`${seasons.version} + 1` }).where(eq(seasons.id, seasonId));
    return { id: created.id, state: "created" as const, number };
  }

  if (found.deletedAt) return { id: found.id, state: "deleted" as const, number: found.number };

  // Number, status and summary belong to the site, so a re-run leaves them alone.
  const isSame =
    found.title === title &&
    found.openingTheme === openingTheme &&
    found.outroTheme === outroTheme;
  if (isSame) return { id: found.id, state: "unchanged" as const, number: found.number };

  const isEdited = found.version > 1;
  if (isEdited && !force) return { id: found.id, state: "protected" as const, number: found.number };

  await tx
    .update(episodes)
    .set({ title, openingTheme, outroTheme, version: isEdited ? found.version + 1 : 1 })
    .where(eq(episodes.id, found.id));
  return { id: found.id, state: "updated" as const, number: found.number };
}

async function applySceneAction(
  tx: Transaction,
  { episodeId, seasonId, position }: { episodeId: string; seasonId: string; position: number },
  item: SceneAction,
) {
  if (item.action === "insert") {
    await tx.insert(scenes).values({
      ...item.scene,
      episodeId,
      position,
      version: 1,
      importKey: item.importKey,
      importSeasonId: seasonId,
    });
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
    .where(and(eq(episodes.seasonId, seasonId), liveScene));
  return rebuildSceneLinks(tx, seriesId, rows);
}

/** Every scene that came from the document, wherever the site has put it. */
const scenesFromImport = (tx: Transaction, seasonId: string): Promise<ExistingScene[]> =>
  tx.select().from(scenes).where(eq(scenes.importSeasonId, seasonId));

async function lastPosition(tx: Transaction, episodeId: string) {
  const [{ last }] = await tx
    .select({ last: sql<number>`coalesce(max(${scenes.position}), 0)::int` })
    .from(scenes)
    .where(eq(scenes.episodeId, episodeId));
  return last;
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

  const synced = await syncCharacters(tx, seriesId, cast);

  const result: ImportResult = {
    seriesId,
    seasonId,
    episodesCreated: 0,
    episodesUpdated: 0,
    episodesProtected: [],
    episodesDeleted: [],
    episodesRenumbered: [],
    scenesInserted: 0,
    scenesUpdated: 0,
    scenesUnchanged: 0,
    scenesProtected: [],
    scenesExtra: [],
    scenesDeleted: [],
    charactersCreated: synced.created,
    charactersMatchedByAlias: synced.matchedByAlias,
    sceneCharacterRows: 0,
  };

  const existing = await scenesFromImport(tx, seasonId);

  for (const episode of script.episodes) {
    const { id: episodeId, state, number } = await syncEpisode(tx, seasonId, episode, options.force);
    if (state === "created") result.episodesCreated++;
    if (state === "updated") result.episodesUpdated++;
    if (state === "protected") result.episodesProtected.push(`Episode ${number}`);
    if (state === "created" && number !== episode.number) {
      result.episodesRenumbered.push(`Document episode ${episode.number} is now Episode ${number}`);
    }
    if (state === "deleted") {
      result.episodesDeleted.push(`Episode ${number}`);
      continue;
    }

    // New scenes go after whatever is there, because the site owns the order.
    let position = await lastPosition(tx, episodeId);
    let inserted = 0;

    for (const item of planScenes(existing, episode.scenes, episode.number, options.force)) {
      if (item.action === "insert") {
        position++;
        inserted++;
      }
      await applySceneAction(tx, { episodeId, seasonId, position }, item);
      if (item.action === "insert") result.scenesInserted++;
      if (item.action === "update") result.scenesUpdated++;
      if (item.action === "unchanged") result.scenesUnchanged++;
      if (item.action === "protected") {
        result.scenesProtected.push(`${item.existing.importKey} (v${item.existing.version})`);
      }
      if (item.action === "deleted") result.scenesDeleted.push(item.existing.importKey!);
    }

    if (inserted > 0) {
      await tx
        .update(episodes)
        .set({ scenesVersion: sql`${episodes.scenesVersion} + 1` })
        .where(eq(episodes.id, episodeId));
    }
  }

  const documentKeys = new Set(
    script.episodes.flatMap(({ number, scenes: parsed }) =>
      parsed.map(({ position }) => sceneImportKey(number, position)),
    ),
  );
  for (const extra of extraScenes(existing, documentKeys)) result.scenesExtra.push(extra.importKey!);

  result.sceneCharacterRows = await rebuildSceneCharacters(tx, seasonId, seriesId);
  return result;
}
