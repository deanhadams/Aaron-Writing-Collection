import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { liveEpisode, liveScene } from "@/lib/db/live";
import { characters, episodes, readingProgress, scenes, seasons } from "@/lib/db/schema";
import type { Database } from "@/lib/scenes/save-scene";

/** Episodes and scene titles only, so the contents drawer never loads the script. */
export async function loadOutline(db: Database, seasonId: string) {
  const [episodeRows, sceneRows] = await Promise.all([
    db
      .select({ id: episodes.id, number: episodes.number, title: episodes.title })
      .from(episodes)
      .where(and(eq(episodes.seasonId, seasonId), liveEpisode))
      .orderBy(asc(episodes.number)),
    db
      .select({ id: scenes.id, episodeId: scenes.episodeId, kind: scenes.kind, title: scenes.title })
      .from(scenes)
      .innerJoin(episodes, eq(scenes.episodeId, episodes.id))
      .where(and(eq(episodes.seasonId, seasonId), liveScene))
      .orderBy(asc(scenes.position)),
  ]);

  return episodeRows.map((episode) => ({
    ...episode,
    scenes: sceneRows.filter((scene) => scene.episodeId === episode.id),
  }));
}

export type Outline = Awaited<ReturnType<typeof loadOutline>>;

export async function seasonCast(db: Database, seasonId: string) {
  return db
    .select({
      name: characters.name,
      fullName: characters.fullName,
      color: characters.color,
      slug: characters.slug,
      aliases: characters.aliases,
    })
    .from(characters)
    .innerJoin(seasons, eq(characters.seriesId, seasons.seriesId))
    .where(eq(seasons.id, seasonId));
}

/** One row per person per season, so this simply overwrites. */
export async function saveProgress(db: Database, { userId, sceneId }: { userId: string; sceneId: string }) {
  const [scene] = await db
    .select({ seasonId: episodes.seasonId })
    .from(scenes)
    .innerJoin(episodes, eq(scenes.episodeId, episodes.id))
    .where(and(eq(scenes.id, sceneId), liveScene));
  if (!scene) return false;

  await db
    .insert(readingProgress)
    .values({ userId, seasonId: scene.seasonId, sceneId })
    .onConflictDoUpdate({
      target: [readingProgress.userId, readingProgress.seasonId],
      set: { sceneId, updatedAt: sql`now()` },
    });
  return true;
}

/** Null if they never started, or the scene has since been deleted. */
export async function loadProgress(db: Database, userId: string, seasonId: string) {
  const [row] = await db
    .select({
      sceneId: scenes.id,
      sceneKind: scenes.kind,
      sceneTitle: scenes.title,
      episodeId: episodes.id,
      episodeNumber: episodes.number,
    })
    .from(readingProgress)
    .innerJoin(scenes, eq(readingProgress.sceneId, scenes.id))
    .innerJoin(episodes, eq(scenes.episodeId, episodes.id))
    .where(
      and(
        eq(readingProgress.userId, userId),
        eq(readingProgress.seasonId, seasonId),
        isNull(scenes.deletedAt),
        liveEpisode,
      ),
    );
  return row ?? null;
}
