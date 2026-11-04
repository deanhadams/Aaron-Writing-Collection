import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lt, sql } from "drizzle-orm";
import { liveEpisode } from "@/lib/db/live";
import { episodes, scenes, seasons, users } from "@/lib/db/schema";
import type { Database, Transaction } from "@/lib/scenes/save-scene";
import { renumber, sameMembers } from "./order";
import { conflict, notFound, retentionCutoff } from "./result";

export async function lockSeason(tx: Transaction, seasonId: string) {
  const [season] = await tx.select().from(seasons).where(eq(seasons.id, seasonId)).for("update");
  return season ?? null;
}

/** The season's version also guards its list of episodes. */
export async function bumpSeason(tx: Transaction, seasonId: string) {
  const [{ version }] = await tx
    .update(seasons)
    .set({ version: sql`${seasons.version} + 1` })
    .where(eq(seasons.id, seasonId))
    .returning({ version: seasons.version });
  return version;
}

const liveEpisodes = (tx: Transaction, seasonId: string) =>
  tx
    .select({ id: episodes.id, number: episodes.number })
    .from(episodes)
    .where(and(eq(episodes.seasonId, seasonId), liveEpisode))
    .orderBy(asc(episodes.number));

export async function updateSeason(
  db: Database,
  input: { seasonId: string; version: number; title: string | null; summary: string | null },
) {
  const { seasonId, version, title, summary } = input;

  return db.transaction(async (tx) => {
    const season = await lockSeason(tx, seasonId);
    if (!season) return notFound;
    if (season.version !== version) return conflict;

    await tx.update(seasons).set({ title, summary }).where(eq(seasons.id, seasonId));
    return { status: "ok" as const, version: await bumpSeason(tx, seasonId) };
  });
}

export async function createEpisode(
  db: Database,
  input: { seasonId: string; version: number; number: number; title: string },
) {
  const { seasonId, version, number, title } = input;

  return db.transaction(async (tx) => {
    const season = await lockSeason(tx, seasonId);
    if (!season) return notFound;
    if (season.version !== version) return conflict;

    const live = await liveEpisodes(tx, seasonId);
    if (live.some((episode) => episode.number === number)) {
      return { status: "number_taken" as const, number };
    }

    const [created] = await tx
      .insert(episodes)
      .values({ seasonId, number, title })
      .returning({ id: episodes.id, number: episodes.number, version: episodes.version });

    return { status: "ok" as const, version: await bumpSeason(tx, seasonId), episode: created };
  });
}

/**
 * The unique index is checked row by row, so moved episodes first step aside
 * onto negative numbers, where they cannot collide with anything.
 */
export async function writeEpisodeNumbers(tx: Transaction, moves: { id: string; number: number }[]) {
  if (moves.length === 0) return;
  const ids = moves.map(({ id }) => id);

  await tx
    .update(episodes)
    .set({ number: sql`-${episodes.number} - 1` })
    .where(inArray(episodes.id, ids));

  const cases = sql.join(
    moves.map(({ id, number }) => sql`when ${episodes.id} = ${id}::uuid then ${number}::int`),
    sql` `,
  );
  await tx
    .update(episodes)
    .set({ number: sql`case ${cases} end` })
    .where(inArray(episodes.id, ids));
}

export async function reorderEpisodes(
  db: Database,
  input: { seasonId: string; version: number; ids: string[] },
) {
  const { seasonId, version, ids } = input;

  return db.transaction(async (tx) => {
    const season = await lockSeason(tx, seasonId);
    if (!season) return notFound;
    if (season.version !== version) return conflict;

    const live = await liveEpisodes(tx, seasonId);
    if (!sameMembers(live.map(({ id }) => id), ids)) return conflict;

    const numbered = renumber(live, ids);
    const current = new Map(live.map(({ id, number }) => [id, number]));
    await writeEpisodeNumbers(tx, numbered.filter(({ id, number }) => current.get(id) !== number));

    return { status: "ok" as const, version: await bumpSeason(tx, seasonId), numbers: numbered };
  });
}

/** Runs with each delete, so nothing needs a scheduled job. Cascades take revisions with them. */
export async function purgeExpired(tx: Transaction, now = new Date()) {
  const cutoff = retentionCutoff(now);
  await tx.delete(scenes).where(lt(scenes.deletedAt, cutoff));
  await tx.delete(episodes).where(lt(episodes.deletedAt, cutoff));
}

export async function listDeleted(db: Database, seasonId: string, now = new Date()) {
  const cutoff = retentionCutoff(now);

  const [deletedEpisodes, deletedScenes] = await Promise.all([
    db
      .select({
        id: episodes.id,
        number: episodes.number,
        title: episodes.title,
        version: episodes.version,
        deletedAt: episodes.deletedAt,
        deletedBy: users.name,
        sceneCount: sql<number>`(
          select count(*)::int from ${scenes}
          where ${scenes.episodeId} = ${episodes.id} and ${scenes.deletedAt} is null
        )`,
      })
      .from(episodes)
      .leftJoin(users, eq(episodes.deletedBy, users.id))
      .where(and(eq(episodes.seasonId, seasonId), isNotNull(episodes.deletedAt), gte(episodes.deletedAt, cutoff)))
      .orderBy(desc(episodes.deletedAt)),
    // A scene in a deleted episode comes back to this list with its episode.
    db
      .select({
        id: scenes.id,
        kind: scenes.kind,
        title: scenes.title,
        version: scenes.version,
        deletedAt: scenes.deletedAt,
        deletedBy: users.name,
        episodeNumber: episodes.number,
        episodeTitle: episodes.title,
      })
      .from(scenes)
      .innerJoin(episodes, eq(scenes.episodeId, episodes.id))
      .leftJoin(users, eq(scenes.deletedBy, users.id))
      .where(
        and(
          eq(episodes.seasonId, seasonId),
          isNull(episodes.deletedAt),
          isNotNull(scenes.deletedAt),
          gte(scenes.deletedAt, cutoff),
        ),
      )
      .orderBy(desc(scenes.deletedAt)),
  ]);

  return { episodes: deletedEpisodes, scenes: deletedScenes };
}
