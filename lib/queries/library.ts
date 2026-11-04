import "server-only";
import { and, asc, desc, eq, isNull, ne, sql } from "drizzle-orm";
import { connection } from "next/server";
import { db } from "@/lib/db";
import { imageUrl } from "@/lib/images";
import { liveEpisode, liveScene } from "@/lib/db/live";
import { summarizeEpisode, summarizeSeason } from "@/lib/script/episode-stats";
import { summarizeBeats } from "@/lib/script/scene-summary";
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
export const isUuid = (value: string) => UUID.test(value);

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

/** The bucket address is a server setting, so browsers get finished urls. */
const withPortrait = <T extends { portraitKey: string | null }>({ portraitKey, ...speaker }: T) => ({
  ...speaker,
  portraitUrl: imageUrl(portraitKey),
});

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
      .where(liveEpisode)
      .orderBy(asc(episodes.number)),
    db
      .select({ ...sceneStatFields, seasonId: episodes.seasonId })
      .from(scenes)
      .innerJoin(episodes, eq(scenes.episodeId, episodes.id))
      .leftJoin(users, eq(scenes.updatedBy, users.id))
      .where(liveScene)
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
      speakers: speakerRows.filter((s) => s.seasonId === season.id).map(withPortrait),
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
      summary: seasons.summary,
      version: seasons.version,
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
        openingTheme: episodes.openingTheme,
        outroTheme: episodes.outroTheme,
        version: episodes.version,
      })
      .from(episodes)
      .where(and(eq(episodes.seasonId, seasonId), liveEpisode))
      .orderBy(asc(episodes.number)),
    db
      .select({ ...sceneStatFields, kind: scenes.kind, title: scenes.title })
      .from(scenes)
      .innerJoin(episodes, eq(scenes.episodeId, episodes.id))
      .leftJoin(users, eq(scenes.updatedBy, users.id))
      .where(and(eq(episodes.seasonId, seasonId), liveScene))
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
      // For the progress bar: every scene's title, already in this one query.
      scenes: sceneRows
        .filter((scene) => scene.episodeId === episode.id)
        .map(({ id, kind, title }) => ({ id, kind, title })),
      speakers: speakerRows.filter((speaker) => speaker.episodeId === episode.id).map(withPortrait),
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
      openingTheme: episodes.openingTheme,
      outroTheme: episodes.outroTheme,
      version: episodes.version,
      scenesVersion: episodes.scenesVersion,
      seasonId: seasons.id,
      seasonNumber: seasons.number,
      seasonTitle: seasons.title,
      seriesTitle: series.title,
    })
    .from(episodes)
    .innerJoin(seasons, eq(episodes.seasonId, seasons.id))
    .innerJoin(series, eq(seasons.seriesId, series.id))
    .where(and(eq(episodes.id, episodeId), liveEpisode))
    .limit(1);

  if (!episode) return null;

  const [sceneRows, speakerRows, otherEpisodes] = await Promise.all([
    db
      .select({
        id: scenes.id,
        kind: scenes.kind,
        title: scenes.title,
        timecode: scenes.timecode,
        location: scenes.location,
        beats: scenes.beats,
        version: scenes.version,
      })
      .from(scenes)
      .where(and(eq(scenes.episodeId, episodeId), isNull(scenes.deletedAt)))
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
    db
      .select({ id: episodes.id, number: episodes.number, title: episodes.title })
      .from(episodes)
      .where(and(eq(episodes.seasonId, episode.seasonId), liveEpisode, ne(episodes.id, episodeId)))
      .orderBy(asc(episodes.number)),
  ]);

  return {
    ...episode,
    otherEpisodes,
    // Summed here so cards never send every scene's beats to the browser.
    scenes: sceneRows.map(({ beats, ...scene }) => ({
      ...scene,
      ...summarizeBeats(beats),
      speakers: speakerRows.filter((speaker) => speaker.sceneId === scene.id).map(withPortrait),
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
      version: scenes.version,
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
    .where(and(eq(scenes.id, sceneId), liveScene))
    .limit(1);

  if (!scene) return null;

  const [siblings, cast] = await Promise.all([
    db
      .select({ id: scenes.id, kind: scenes.kind, title: scenes.title })
      .from(scenes)
      .where(and(eq(scenes.episodeId, scene.episodeId), isNull(scenes.deletedAt)))
      .orderBy(asc(scenes.position)),
    db
      .select({
        name: characters.name,
        fullName: characters.fullName,
        color: characters.color,
        slug: characters.slug,
        aliases: characters.aliases,
      })
      .from(characters)
      .where(eq(characters.seriesId, scene.seriesId))
      .orderBy(asc(characters.name)),
  ]);

  const index = siblings.findIndex((sibling) => sibling.id === sceneId);

  return {
    ...scene,
    previous: siblings[index - 1] ?? null,
    next: siblings[index + 1] ?? null,
    cast,
  };
}
