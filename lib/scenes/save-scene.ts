import { and, desc, eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import {
  characters,
  episodes,
  sceneCharacters,
  sceneRevisions,
  scenes,
  seasons,
  users,
  type Beat,
} from "@/lib/db/schema";
import { speakerLineCounts } from "@/lib/script/scene-summary";
import type { SceneFields } from "./validate";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = PgDatabase<PgQueryResultHKT, any, any>;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

export type SaveResult =
  | { status: "saved"; version: number }
  | { status: "conflict"; version: number }
  | { status: "not_found" };

export type SavedScene = SceneFields & { version: number };

/** One revision per person per this long of editing, counted from when it was written. */
export const REVISION_WINDOW_MS = 5 * 60 * 1000;

// jsonb reorders keys, so beats compare field by field.
const beatContent = ({ id, type, character, parenthetical, text }: Beat) => [
  id,
  type,
  character ?? null,
  parenthetical ?? null,
  text,
];

const sameContent = (a: SceneFields, b: SceneFields) =>
  JSON.stringify([a.title, a.timecode, a.location, a.beats.map(beatContent)]) ===
  JSON.stringify([b.title, b.timecode, b.location, b.beats.map(beatContent)]);

async function lockScene(tx: Transaction, sceneId: string) {
  const [scene] = await tx
    .select({
      title: scenes.title,
      timecode: scenes.timecode,
      location: scenes.location,
      beats: scenes.beats,
      version: scenes.version,
      updatedBy: scenes.updatedBy,
      updatedAt: scenes.updatedAt,
      seriesId: seasons.seriesId,
    })
    .from(scenes)
    .innerJoin(episodes, eq(scenes.episodeId, episodes.id))
    .innerJoin(seasons, eq(episodes.seasonId, seasons.id))
    .where(eq(scenes.id, sceneId))
    .for("update", { of: scenes });

  return scene ?? null;
}

// Names with no character row, like INTERCOM, simply get no link.
async function rebuildSceneCharacters(
  tx: Transaction,
  sceneId: string,
  seriesId: string,
  beats: Beat[],
) {
  const cast = await tx
    .select({ id: characters.id, name: characters.name })
    .from(characters)
    .where(eq(characters.seriesId, seriesId));
  const ids = new Map(cast.map(({ id, name }) => [name.toUpperCase(), id]));

  const links = [...speakerLineCounts(beats)].flatMap(([name, lineCount]) => {
    const characterId = ids.get(name);
    return characterId ? [{ sceneId, characterId, lineCount }] : [];
  });

  await tx.delete(sceneCharacters).where(eq(sceneCharacters.sceneId, sceneId));
  if (links.length > 0) await tx.insert(sceneCharacters).values(links);
}

type LockedScene = NonNullable<Awaited<ReturnType<typeof lockScene>>>;

/**
 * The revision keeps the version being replaced, credited to whoever saved it.
 * Saves by one person within the window share a row, which ends up holding the
 * last version they wrote in it. A restore always seals a new row of its own.
 */
async function keepRevision(tx: Transaction, sceneId: string, current: LockedScene, seal: boolean) {
  const { beats, title, timecode, location, updatedBy, updatedAt } = current;
  const content = { beats, title, timecode, location };

  const [latest] = await tx
    .select({
      id: sceneRevisions.id,
      savedBy: sceneRevisions.savedBy,
      savedAt: sceneRevisions.savedAt,
      sealed: sceneRevisions.sealed,
    })
    .from(sceneRevisions)
    .where(eq(sceneRevisions.sceneId, sceneId))
    .orderBy(desc(sceneRevisions.savedAt), desc(sceneRevisions.id))
    .limit(1);

  const canMerge =
    !seal &&
    latest &&
    !latest.sealed &&
    updatedBy !== null &&
    latest.savedBy === updatedBy &&
    updatedAt.getTime() - latest.savedAt.getTime() < REVISION_WINDOW_MS;

  if (canMerge) {
    await tx.update(sceneRevisions).set(content).where(eq(sceneRevisions.id, latest.id));
  } else {
    await tx.insert(sceneRevisions).values({
      ...content,
      sceneId,
      sealed: seal,
      savedBy: updatedBy,
      savedAt: updatedAt,
    });
  }
}

async function writeVersion(
  tx: Transaction,
  sceneId: string,
  current: LockedScene,
  fields: SceneFields,
  userId: string,
  { seal = false } = {},
) {
  await keepRevision(tx, sceneId, current, seal);

  const version = current.version + 1;
  await tx
    .update(scenes)
    .set({ ...fields, version, updatedBy: userId, updatedAt: new Date() })
    .where(eq(scenes.id, sceneId));
  await rebuildSceneCharacters(tx, sceneId, current.seriesId, fields.beats);

  return version;
}

export async function saveScene(
  db: Database,
  input: SceneFields & { sceneId: string; userId: string; version: number },
): Promise<SaveResult> {
  const { sceneId, userId, version, title, timecode, location, beats } = input;
  const fields = { title, timecode, location, beats };

  return db.transaction(async (tx) => {
    const current = await lockScene(tx, sceneId);
    if (!current) return { status: "not_found" };

    if (current.version !== version) {
      // A retry after a lost response: this save already landed.
      const isOwnRetry = current.updatedBy === userId && sameContent(current, fields);
      return {
        status: isOwnRetry ? "saved" : "conflict",
        version: current.version,
      };
    }

    return { status: "saved", version: await writeVersion(tx, sceneId, current, fields, userId) };
  });
}

/** Saves an old version as a new one, so the current beats go into history first. */
export async function restoreRevision(
  db: Database,
  input: { sceneId: string; revisionId: string; userId: string; version: number },
): Promise<SaveResult | ({ status: "saved"; version: number } & SceneFields)> {
  const { sceneId, revisionId, userId, version } = input;

  return db.transaction(async (tx) => {
    const current = await lockScene(tx, sceneId);
    if (!current) return { status: "not_found" };
    if (current.version !== version) return { status: "conflict", version: current.version };

    const [revision] = await tx
      .select({
        beats: sceneRevisions.beats,
        title: sceneRevisions.title,
        timecode: sceneRevisions.timecode,
        location: sceneRevisions.location,
      })
      .from(sceneRevisions)
      .where(and(eq(sceneRevisions.id, revisionId), eq(sceneRevisions.sceneId, sceneId)));
    if (!revision) return { status: "not_found" };

    // Revisions from before these columns have none, so the header stays as it is.
    const hasHeader = Boolean(revision.title || revision.timecode || revision.location);
    const fields = {
      title: hasHeader ? revision.title : current.title,
      timecode: hasHeader ? revision.timecode : current.timecode,
      location: hasHeader ? revision.location : current.location,
      beats: revision.beats,
    };
    const saved = await writeVersion(tx, sceneId, current, fields, userId, { seal: true });

    return { status: "saved", version: saved, ...fields };
  });
}

export async function getSavedScene(db: Database, sceneId: string): Promise<SavedScene | null> {
  const [scene] = await db
    .select({
      title: scenes.title,
      timecode: scenes.timecode,
      location: scenes.location,
      beats: scenes.beats,
      version: scenes.version,
    })
    .from(scenes)
    .where(eq(scenes.id, sceneId));

  return scene ?? null;
}

const PREVIEW_BEATS = 8;
const HISTORY_LIMIT = 50;

export async function listRevisions(db: Database, sceneId: string) {
  const rows = await db
    .select({
      id: sceneRevisions.id,
      beats: sceneRevisions.beats,
      title: sceneRevisions.title,
      timecode: sceneRevisions.timecode,
      location: sceneRevisions.location,
      sealed: sceneRevisions.sealed,
      savedAt: sceneRevisions.savedAt,
      savedBy: users.name,
    })
    .from(sceneRevisions)
    .leftJoin(users, eq(sceneRevisions.savedBy, users.id))
    .where(eq(sceneRevisions.sceneId, sceneId))
    .orderBy(desc(sceneRevisions.savedAt), desc(sceneRevisions.id))
    .limit(HISTORY_LIMIT);

  return rows.map(({ beats, ...revision }) => ({
    ...revision,
    beatCount: beats.length,
    preview: beats.slice(0, PREVIEW_BEATS),
  }));
}
