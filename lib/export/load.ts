import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { slugify } from "@/lib/characters/slug";
import { liveEpisode } from "@/lib/db/live";
import { episodes, scenes, seasons, series } from "@/lib/db/schema";
import type { Database } from "@/lib/scenes/save-scene";
import { renderDocx } from "./docx";
import { scriptLines, type ExportEpisode } from "./lines";

export type ScriptEpisode = Omit<ExportEpisode, "scenes"> & {
  id: string;
  scenes: (ExportEpisode["scenes"][number] & { id: string })[];
};

/** A season's live episodes and scenes, in script order. Pass episodeId for just one. */
export async function loadScript(db: Database, seasonId: string, episodeId?: string) {
  const [season] = await db
    .select({ id: seasons.id, number: seasons.number, title: seasons.title, seriesTitle: series.title })
    .from(seasons)
    .innerJoin(series, eq(seasons.seriesId, series.id))
    .where(eq(seasons.id, seasonId));
  if (!season) return null;

  const episodeRows = await db
    .select({
      id: episodes.id,
      number: episodes.number,
      title: episodes.title,
      openingTheme: episodes.openingTheme,
      outroTheme: episodes.outroTheme,
    })
    .from(episodes)
    .where(and(eq(episodes.seasonId, seasonId), liveEpisode, episodeId ? eq(episodes.id, episodeId) : undefined))
    .orderBy(asc(episodes.number));
  if (episodeRows.length === 0) return { season, episodes: [] as ScriptEpisode[] };

  const sceneRows = await db
    .select({
      id: scenes.id,
      episodeId: scenes.episodeId,
      kind: scenes.kind,
      title: scenes.title,
      timecode: scenes.timecode,
      location: scenes.location,
      beats: scenes.beats,
    })
    .from(scenes)
    .where(and(inArray(scenes.episodeId, episodeRows.map(({ id }) => id)), isNull(scenes.deletedAt)))
    .orderBy(asc(scenes.position));

  return {
    season,
    episodes: episodeRows.map((episode) => ({
      ...episode,
      scenes: sceneRows.filter((scene) => scene.episodeId === episode.id),
    })),
  };
}

export async function episodeSeasonId(db: Database, episodeId: string) {
  const [row] = await db
    .select({ seasonId: episodes.seasonId })
    .from(episodes)
    .where(and(eq(episodes.id, episodeId), liveEpisode));
  return row?.seasonId ?? null;
}

export async function seasonDocx(db: Database, seasonId: string, episodeId?: string) {
  const script = await loadScript(db, seasonId, episodeId);
  if (!script) return null;

  const { season, episodes: list } = script;
  const base = `${slugify(season.seriesTitle)}-season-${season.number}`;
  const name = episodeId && list[0] ? `${base}-episode-${list[0].number}-${slugify(list[0].title)}` : base;
  const title = episodeId && list[0] ? `Episode ${list[0].number}: ${list[0].title}` : `${season.seriesTitle}, Season ${season.number}`;

  return { fileName: `${name}.docx`, buffer: await renderDocx(scriptLines(season.number, list), title) };
}

export const DOCX_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
