import "server-only";
import { asc, desc, eq, sql } from "drizzle-orm";
import { connection } from "next/server";
import { db } from "@/lib/db";
import { summarizeEpisode, summarizeSeason } from "@/lib/script/episode-stats";
import {
  characters,
  episodes,
  sceneCharacters,
  scenes,
  seasons,
  series,
  users,
} from "@/lib/db/schema";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Postgres rejects a malformed uuid with an error, which would show as a 500
// for a mistyped URL. Treat those as "not found" instead.
const isUuid = (value: string) => UUID.test(value);

// Counted in SQL so listing pages never download every scene's beats.
const sceneStatFields = {
  id: scenes.id,
  episodeId: scenes.episodeId,
  timecode: scenes.timecode,
  updatedAt: scenes.updatedAt,
  editor: users.name,
  lineCount: sql<number>`(
    select count(*)::int from jsonb_array_elements(${scenes.beats}) as beat
    where beat->>'type' in ('dialogue', 'vo')
  )`,
  firstVisual: sql<string | null>`jsonb_path_query_first(
    ${scenes.beats}, '$[*] ? (@.type == "visual" && @.text != "").text'
  ) #>> '{}'`,
};

// connection() keeps these reads at request time, so edits always show and
// nothing is baked into the build.
export async function getSeasonCards() {
  await connection();

  // Four queries however many seasons there are.
  const [seasonRows, episodeRows, sceneRows, speakerRows] = await Promise.all([
    db
      .select({
        id: seasons.id,
        number: seasons.number,
        title: seasons.title,
        seriesTitle: series.title,
        description: series.description,
      })
      .from(seasons)
      .innerJoin(series, eq(seasons.seriesId, series.id))
      .orderBy(asc(series.title), asc(seasons.number)),
    db
      .select({
        id: episodes.id,
        seasonId: episodes.seasonId,
        number: episodes.number,
        title: episodes.title,
        status: episodes.status,
      })
      .from(episodes)
      .orderBy(asc(episodes.number)),
    db
      .select({ ...sceneStatFields, seasonId: episodes.seasonId })
      .from(scenes)
      .innerJoin(episodes, eq(scenes.episodeId, episodes.id))
      .leftJoin(users, eq(scenes.updatedBy, users.id))
      .orderBy(asc(episodes.number), asc(scenes.position)),
    db
      .select({
        seasonId: episodes.seasonId,
        name: characters.name,
        color: characters.color,
        portraitKey: characters.portraitKey,
      })
      .from(sceneCharacters)
      .innerJoin(scenes, eq(sceneCharacters.sceneId, scenes.id))
      .innerJoin(episodes, eq(scenes.episodeId, episodes.id))
      .innerJoin(characters, eq(sceneCharacters.characterId, characters.id))
      .groupBy(episodes.seasonId, characters.id)
      .orderBy(desc(sql`sum(${sceneCharacters.lineCount})`), asc(characters.name)),
  ]);

  return seasonRows.map((season) => {
    const seasonEpisodes = episodeRows.filter((e) => e.seasonId === season.id);

    return {
      ...season,
      episodes: seasonEpisodes,
      speakers: speakerRows.filter((s) => s.seasonId === season.id),
      stats: summarizeSeason(
        seasonEpisodes,
        sceneRows.filter((scene) => scene.seasonId === season.id),
      ),
    };
  });
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

  // Three queries however many episodes there are.
  const [episodeRows, sceneRows, speakerRows] = await Promise.all([
    db
      .select({
        id: episodes.id,
        number: episodes.number,
        title: episodes.title,
        status: episodes.status,
        summary: episodes.summary,
      })
      .from(episodes)
      .where(eq(episodes.seasonId, seasonId))
      .orderBy(asc(episodes.number)),
    db
      .select(sceneStatFields)
      .from(scenes)
      .innerJoin(episodes, eq(scenes.episodeId, episodes.id))
      .leftJoin(users, eq(scenes.updatedBy, users.id))
      .where(eq(episodes.seasonId, seasonId))
      .orderBy(asc(scenes.position)),
    db
      .select({
        episodeId: scenes.episodeId,
        name: characters.name,
        color: characters.color,
        portraitKey: characters.portraitKey,
      })
      .from(sceneCharacters)
      .innerJoin(scenes, eq(sceneCharacters.sceneId, scenes.id))
      .innerJoin(episodes, eq(scenes.episodeId, episodes.id))
      .innerJoin(characters, eq(sceneCharacters.characterId, characters.id))
      .where(eq(episodes.seasonId, seasonId))
      .groupBy(scenes.episodeId, characters.id)
      .orderBy(desc(sql`sum(${sceneCharacters.lineCount})`), asc(characters.name)),
  ]);

  return {
    ...season,
    episodes: episodeRows.map((episode) => ({
      ...episode,
      stats: summarizeEpisode(
        sceneRows.filter((scene) => scene.episodeId === episode.id),
      ),
      speakers: speakerRows.filter((speaker) => speaker.episodeId === episode.id),
    })),
  };
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

  const [sceneRows, speakerRows] = await Promise.all([
    db
      .select({
        id: scenes.id,
        kind: scenes.kind,
        title: scenes.title,
        timecode: scenes.timecode,
        location: scenes.location,
        beats: scenes.beats,
      })
      .from(scenes)
      .where(eq(scenes.episodeId, episodeId))
      .orderBy(asc(scenes.position)),
    db
      .select({
        sceneId: sceneCharacters.sceneId,
        name: characters.name,
        color: characters.color,
        portraitKey: characters.portraitKey,
      })
      .from(sceneCharacters)
      .innerJoin(characters, eq(sceneCharacters.characterId, characters.id))
      .innerJoin(scenes, eq(sceneCharacters.sceneId, scenes.id))
      .where(eq(scenes.episodeId, episodeId))
      .orderBy(desc(sceneCharacters.lineCount), asc(characters.name)),
  ]);

  return {
    ...episode,
    scenes: sceneRows.map((scene) => ({
      ...scene,
      speakers: speakerRows.filter((speaker) => speaker.sceneId === scene.id),
    })),
  };
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
