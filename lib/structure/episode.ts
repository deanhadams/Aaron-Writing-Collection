import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { liveEpisode } from "@/lib/db/live";
import { episodes, sceneCharacters, scenes, seasons } from "@/lib/db/schema";
import type { Database, Transaction } from "@/lib/scenes/save-scene";
import { rebuildSceneLinks } from "@/lib/scenes/scene-links";
import { nextNumber, sameMembers, type Status } from "./order";
import { conflict, notFound, retentionCutoff } from "./result";
import { bumpSeason, lockSeason, purgeExpired } from "./season";

export type EpisodePatch = {
  title?: string;
  status?: Status;
  summary?: string | null;
  openingTheme?: string | null;
  outroTheme?: string | null;
};

export async function lockEpisode(tx: Transaction, episodeId: string) {
  const [episode] = await tx.select().from(episodes).where(eq(episodes.id, episodeId)).for("update");
  return episode ?? null;
}

export async function bumpScenes(tx: Transaction, episodeId: string) {
  const [{ scenesVersion }] = await tx
    .update(episodes)
    .set({ scenesVersion: sql`${episodes.scenesVersion} + 1` })
    .where(eq(episodes.id, episodeId))
    .returning({ scenesVersion: episodes.scenesVersion });
  return scenesVersion;
}

export const liveSceneIds = async (tx: Transaction, episodeId: string) => {
  const rows = await tx
    .select({ id: scenes.id })
    .from(scenes)
    .where(and(eq(scenes.episodeId, episodeId), isNull(scenes.deletedAt)))
    .orderBy(asc(scenes.position), asc(scenes.id));
  return rows.map(({ id }) => id);
};

/** Positions only: beats do not change, so this writes no revision and no version. */
export async function writePositions(tx: Transaction, ids: string[]) {
  if (ids.length === 0) return;

  const cases = sql.join(
    ids.map((id, index) => sql`when ${scenes.id} = ${id}::uuid then ${index + 1}::int`),
    sql` `,
  );
  await tx
    .update(scenes)
    .set({ position: sql`case ${cases} end` })
    .where(inArray(scenes.id, ids));
}

export async function updateEpisode(
  db: Database,
  { episodeId, version, patch }: { episodeId: string; version: number; patch: EpisodePatch },
) {
  return db.transaction(async (tx) => {
    const episode = await lockEpisode(tx, episodeId);
    if (!episode || episode.deletedAt) return notFound;
    if (episode.version !== version) return conflict;

    const isSame = (Object.keys(patch) as (keyof EpisodePatch)[]).every((field) => patch[field] === episode[field]);
    if (isSame) return { status: "ok" as const, version };

    await tx
      .update(episodes)
      .set({ ...patch, version: version + 1 })
      .where(eq(episodes.id, episodeId));
    return { status: "ok" as const, version: version + 1 };
  });
}

/**
 * Leaves the scenes' own deleted_at empty, so a restore brings back exactly the
 * scenes that were live. The version stays put: nothing about the episode changed.
 */
export async function deleteEpisode(
  db: Database,
  { episodeId, version, userId }: { episodeId: string; version: number; userId: string },
) {
  return db.transaction(async (tx) => {
    const [found] = await tx
      .select({ seasonId: episodes.seasonId })
      .from(episodes)
      .where(eq(episodes.id, episodeId));
    if (!found) return notFound;

    await lockSeason(tx, found.seasonId);
    const episode = await lockEpisode(tx, episodeId);
    if (!episode || episode.deletedAt) return notFound;
    if (episode.version !== version) return conflict;

    await tx
      .update(episodes)
      .set({ deletedAt: new Date(), deletedBy: userId })
      .where(eq(episodes.id, episodeId));

    const ids = await liveSceneIds(tx, episodeId);
    if (ids.length > 0) await tx.delete(sceneCharacters).where(inArray(sceneCharacters.sceneId, ids));
    await purgeExpired(tx);

    return { status: "ok" as const, seasonVersion: await bumpSeason(tx, found.seasonId) };
  });
}

/** A number taken since the delete goes to the end, so nothing else has to move. */
export async function restoreEpisode(
  db: Database,
  { episodeId, version }: { episodeId: string; version: number },
) {
  return db.transaction(async (tx) => {
    const [found] = await tx
      .select({ seasonId: episodes.seasonId, seriesId: seasons.seriesId })
      .from(episodes)
      .innerJoin(seasons, eq(episodes.seasonId, seasons.id))
      .where(eq(episodes.id, episodeId));
    if (!found) return notFound;

    await lockSeason(tx, found.seasonId);
    const episode = await lockEpisode(tx, episodeId);
    if (!episode?.deletedAt || episode.version !== version) return conflict;
    if (episode.deletedAt < retentionCutoff()) return notFound;

    const live = await tx
      .select({ number: episodes.number })
      .from(episodes)
      .where(and(eq(episodes.seasonId, found.seasonId), liveEpisode));
    const numbers = live.map(({ number }) => number);
    const number = numbers.includes(episode.number) ? nextNumber(numbers) : episode.number;

    await tx
      .update(episodes)
      .set({ deletedAt: null, deletedBy: null, number })
      .where(eq(episodes.id, episodeId));

    const rows = await tx
      .select({ id: scenes.id, beats: scenes.beats })
      .from(scenes)
      .where(and(eq(scenes.episodeId, episodeId), isNull(scenes.deletedAt)));
    await rebuildSceneLinks(tx, found.seriesId, rows);

    return {
      status: "ok" as const,
      number,
      renumbered: number !== episode.number,
      seasonVersion: await bumpSeason(tx, found.seasonId),
    };
  });
}

export async function reorderScenes(
  db: Database,
  { episodeId, version, ids }: { episodeId: string; version: number; ids: string[] },
) {
  return db.transaction(async (tx) => {
    const episode = await lockEpisode(tx, episodeId);
    if (!episode || episode.deletedAt) return notFound;
    if (episode.scenesVersion !== version) return conflict;
    if (!sameMembers(await liveSceneIds(tx, episodeId), ids)) return conflict;

    await writePositions(tx, ids);
    return { status: "ok" as const, version: await bumpScenes(tx, episodeId) };
  });
}
