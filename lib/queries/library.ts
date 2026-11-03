import "server-only";
import { asc, eq, sql } from "drizzle-orm";
import { connection } from "next/server";
import { db } from "@/lib/db";
import {
  characters,
  episodes,
  scenes,
  seasons,
  series,
} from "@/lib/db/schema";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Postgres rejects a malformed uuid with an error, which would show as a 500
// for a mistyped URL. Treat those as "not found" instead.
const isUuid = (value: string) => UUID.test(value);

const sceneCount = sql<number>`count(${scenes.id})::int`;

// connection() keeps these reads at request time, so edits always show and
// nothing is baked into the build.
export async function getSeasonCards() {
  await connection();

  return db
    .select({
      id: seasons.id,
      number: seasons.number,
      title: seasons.title,
      seriesTitle: series.title,
      episodeCount: sql<number>`count(distinct ${episodes.id})::int`,
      doneCount: sql<number>`count(distinct ${episodes.id}) filter (where ${episodes.status} = 'done')::int`,
      lastEdited: sql<Date | null>`max(${scenes.updatedAt})`.mapWith(
        scenes.updatedAt,
      ),
    })
    .from(seasons)
    .innerJoin(series, eq(seasons.seriesId, series.id))
    .leftJoin(episodes, eq(episodes.seasonId, seasons.id))
    .leftJoin(scenes, eq(scenes.episodeId, episodes.id))
    .groupBy(seasons.id, series.id)
    .orderBy(asc(series.title), asc(seasons.number));
}

export async function getSeason(seasonId: string) {
  await connection();
  if (!isUuid(seasonId)) return null;

  const [season] = await db
    .select({
      id: seasons.id,
      number: seasons.number,
      title: seasons.title,
      seriesTitle: series.title,
    })
    .from(seasons)
    .innerJoin(series, eq(seasons.seriesId, series.id))
    .where(eq(seasons.id, seasonId))
    .limit(1);

  if (!season) return null;

  const episodeRows = await db
    .select({
      id: episodes.id,
      number: episodes.number,
      title: episodes.title,
      status: episodes.status,
      sceneCount,
    })
    .from(episodes)
    .leftJoin(scenes, eq(scenes.episodeId, episodes.id))
    .where(eq(episodes.seasonId, seasonId))
    .groupBy(episodes.id)
    .orderBy(asc(episodes.number));

  return { ...season, episodes: episodeRows };
}

export async function getEpisode(episodeId: string) {
  await connection();
  if (!isUuid(episodeId)) return null;

  const [episode] = await db
    .select({
      id: episodes.id,
      number: episodes.number,
      title: episodes.title,
      status: episodes.status,
      summary: episodes.summary,
      seasonId: seasons.id,
      seasonNumber: seasons.number,
      seasonTitle: seasons.title,
      seriesTitle: series.title,
    })
    .from(episodes)
    .innerJoin(seasons, eq(episodes.seasonId, seasons.id))
    .innerJoin(series, eq(seasons.seriesId, series.id))
    .where(eq(episodes.id, episodeId))
    .limit(1);

  if (!episode) return null;

  const sceneRows = await db
    .select({
      id: scenes.id,
      kind: scenes.kind,
      title: scenes.title,
      timecode: scenes.timecode,
      location: scenes.location,
      beatCount: sql<number>`jsonb_array_length(${scenes.beats})::int`,
    })
    .from(scenes)
    .where(eq(scenes.episodeId, episodeId))
    .orderBy(asc(scenes.position));

  return { ...episode, scenes: sceneRows };
}

export async function getScene(sceneId: string) {
  await connection();
  if (!isUuid(sceneId)) return null;

  const [scene] = await db
    .select({
      id: scenes.id,
      kind: scenes.kind,
      title: scenes.title,
      timecode: scenes.timecode,
      location: scenes.location,
      beats: scenes.beats,
      episodeId: episodes.id,
      episodeNumber: episodes.number,
      episodeTitle: episodes.title,
      seasonId: seasons.id,
      seasonNumber: seasons.number,
      seasonTitle: seasons.title,
      seriesId: seasons.seriesId,
      seriesTitle: series.title,
    })
    .from(scenes)
    .innerJoin(episodes, eq(scenes.episodeId, episodes.id))
    .innerJoin(seasons, eq(episodes.seasonId, seasons.id))
    .innerJoin(series, eq(seasons.seriesId, series.id))
    .where(eq(scenes.id, sceneId))
    .limit(1);

  if (!scene) return null;

  const [siblings, cast] = await Promise.all([
    db
      .select({ id: scenes.id, kind: scenes.kind, title: scenes.title })
      .from(scenes)
      .where(eq(scenes.episodeId, scene.episodeId))
      .orderBy(asc(scenes.position)),
    db
      .select({ name: characters.name, color: characters.color })
      .from(characters)
      .where(eq(characters.seriesId, scene.seriesId)),
  ]);

  const index = siblings.findIndex((sibling) => sibling.id === sceneId);

  return {
    ...scene,
    previous: siblings[index - 1] ?? null,
    next: siblings[index + 1] ?? null,
    characterColors: new Map(
      cast.map(({ name, color }) => [name.toUpperCase(), color]),
    ),
  };
}
