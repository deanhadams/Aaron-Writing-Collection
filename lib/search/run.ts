import { and, asc, desc, eq, inArray, isNull, sql, type SQL, type SQLWrapper } from "drizzle-orm";
import { liveEpisode, liveScene } from "@/lib/db/live";
import { characters, episodes, loreEntries, scenes, seasons } from "@/lib/db/schema";
import { imageUrl } from "@/lib/images";
import type { Database } from "@/lib/scenes/save-scene";
import {
  episodeJump,
  hasSceneFilter,
  hasText,
  isEmptyQuery,
  parseQuery,
  toTsQuery,
  type ParsedQuery,
} from "./query";
import { bestBeat, highlight, type BeatSnippet, type Segment } from "./snippet";

/** Tuned on invented names: "Revok" finds "Revoc", and "Desrun" does not find "Destroy". */
const TYPO_THRESHOLD = 0.5;
const MIN_TYPO_LENGTH = 4;

const vector = (column: SQLWrapper) => sql`to_tsvector('simple', ${column})`;
const tsQuery = (text: string) => sql`to_tsquery('simple', ${text})`;

const hits = (column: SQLWrapper, text: string) => sql`${vector(column)} @@ ${tsQuery(text)}`;

function termCondition(column: SQLWrapper, term: string[]) {
  const exact = hits(column, toTsQuery(term, true));
  const whole = term.join(" ");
  if (whole.length < MIN_TYPO_LENGTH) return exact;
  return sql`(${exact} OR word_similarity(${whole}, ${column}) >= ${TYPO_THRESHOLD})`;
}

function textConditions(column: SQLWrapper, { terms, phrases, excludes }: ParsedQuery): SQL[] {
  return [
    ...terms.map((term) => termCondition(column, term)),
    ...phrases.map((phrase) => hits(column, toTsQuery(phrase, false))),
    ...excludes.map((exclude) => sql`NOT ${hits(column, toTsQuery(exclude, false))}`),
  ];
}

/** Exact matches rank by how often they appear; typos follow, closest first. */
function score(column: SQLWrapper, { terms, phrases }: ParsedQuery) {
  const all = [...terms.map((term) => toTsQuery(term, true)), ...phrases.map((phrase) => toTsQuery(phrase, false))];
  if (all.length === 0) return sql`0`;

  const whole = terms.flat().join(" ");
  const anyMatch = all.join(" | ");
  return sql`ts_rank(${vector(column)}, ${tsQuery(anyMatch)}) + word_similarity(${whole}, ${column}) * 0.01`;
}

/**
 * A line by this person, saying these words: "speaker:Revoc hell" means Revoc
 * says it, not that Revoc is in a scene where someone else does. A card's other
 * names count, so an old name in a script still finds them.
 */
function speakerCondition(name: string, query: ParsedQuery) {
  const speaker = sql`search_clean(beat->>'character')`;
  const line = sql`search_join(beat->>'parenthetical', beat->>'text')`;
  const said = textConditions(line, { ...query, excludes: [] });

  return sql`EXISTS (
    SELECT 1 FROM jsonb_array_elements(${scenes.beats}) AS beat
    WHERE beat->>'type' IN ('dialogue', 'vo')
      AND (
        strpos(${speaker}, ${name}) > 0
        OR EXISTS (
          SELECT 1 FROM characters AS card
          WHERE strpos(search_join(VARIADIC (ARRAY[card.name] || card.aliases)), ${name}) > 0
            AND ${speaker} = ANY (SELECT search_clean(known) FROM unnest(ARRAY[card.name] || card.aliases) AS known)
        )
      )
      ${said.length > 0 ? sql`AND ${and(...said)}` : sql``}
  )`;
}

const totalCount = sql<number>`count(*) OVER ()::int`;

export type SearchOptions = { limit: number; offset?: number; sort?: "best" | "episode" };

export type SceneResult = {
  id: string;
  title: string | null;
  kind: "prologue" | "scene" | "outro" | "post_credit";
  timecode: string | null;
  location: string | null;
  episodeId: string;
  episodeNumber: number;
  episodeTitle: string;
  seasonId: string;
  snippet: BeatSnippet | null;
};

async function searchScenes(db: Database, query: ParsedQuery, { limit, offset = 0, sort = "best" }: SearchOptions) {
  const { speakers, kinds, episodes: range } = query;
  const rank = score(scenes.searchText, query);

  const rows = await db
    .select({
      id: scenes.id,
      title: scenes.title,
      kind: scenes.kind,
      timecode: scenes.timecode,
      location: scenes.location,
      beats: scenes.beats,
      episodeId: episodes.id,
      episodeNumber: episodes.number,
      episodeTitle: episodes.title,
      seasonId: episodes.seasonId,
      total: totalCount,
    })
    .from(scenes)
    .innerJoin(episodes, eq(scenes.episodeId, episodes.id))
    .where(
      and(
        liveScene,
        ...textConditions(scenes.searchText, query),
        ...speakers.map((name) => speakerCondition(name, query)),
        kinds.length > 0 ? inArray(scenes.kind, kinds) : undefined,
        range ? sql`${episodes.number} BETWEEN ${range.from} AND ${range.to}` : undefined,
      ),
    )
    .orderBy(
      ...(sort === "best" && hasText(query) ? [desc(rank)] : []),
      asc(episodes.number),
      asc(scenes.position),
    )
    .limit(limit)
    .offset(offset);

  return {
    total: rows[0]?.total ?? 0,
    results: rows.map(({ beats, ...scene }): SceneResult => ({ ...scene, snippet: bestBeat(beats, query) })),
  };
}

async function searchEpisodes(db: Database, query: ParsedQuery, { limit, offset = 0 }: SearchOptions) {
  const rows = await db
    .select({
      id: episodes.id,
      number: episodes.number,
      title: episodes.title,
      summary: episodes.summary,
      status: episodes.status,
      total: totalCount,
    })
    .from(episodes)
    .where(and(liveEpisode, ...textConditions(episodes.searchText, query)))
    .orderBy(desc(score(episodes.searchText, query)), asc(episodes.number))
    .limit(limit)
    .offset(offset);

  return {
    total: rows[0]?.total ?? 0,
    results: rows.map((episode) => ({ ...episode, segments: highlight(episode.title, query) })),
  };
}

async function searchCharacters(db: Database, query: ParsedQuery, { limit, offset = 0 }: SearchOptions) {
  const name = query.terms.flat().join(" ");

  const rows = await db
    .select({
      id: characters.id,
      slug: characters.slug,
      name: characters.name,
      fullName: characters.fullName,
      role: characters.role,
      color: characters.color,
      portraitKey: characters.portraitKey,
      total: totalCount,
    })
    .from(characters)
    .where(and(...textConditions(characters.searchText, query)))
    .orderBy(
      // A name match outranks a passing mention in someone else's backstory.
      desc(sql`word_similarity(${name}, search_join(${characters.name}, ${characters.fullName}))`),
      desc(score(characters.searchText, query)),
      asc(characters.name),
    )
    .limit(limit)
    .offset(offset);

  return {
    total: rows[0]?.total ?? 0,
    results: rows.map(({ portraitKey, ...character }) => ({
      ...character,
      portraitUrl: imageUrl(portraitKey),
      segments: highlight(character.name, query),
    })),
  };
}

async function searchLore(db: Database, query: ParsedQuery, { limit, offset = 0 }: SearchOptions) {
  const rows = await db
    .select({
      id: loreEntries.id,
      slug: loreEntries.slug,
      title: loreEntries.title,
      category: loreEntries.category,
      summary: loreEntries.summary,
      total: totalCount,
    })
    .from(loreEntries)
    .where(and(isNull(loreEntries.deletedAt), ...textConditions(loreEntries.searchText, query)))
    .orderBy(desc(score(loreEntries.searchText, query)), asc(loreEntries.title))
    .limit(limit)
    .offset(offset);

  return {
    total: rows[0]?.total ?? 0,
    results: rows.map((entry) => ({ ...entry, segments: highlight(entry.title, query) })),
  };
}

export type SearchType = "scenes" | "episodes" | "characters" | "lore";
export const SEARCH_TYPES: SearchType[] = ["scenes", "episodes", "characters", "lore"];

const empty = { total: 0, results: [] };

export type EpisodeResult = Awaited<ReturnType<typeof searchEpisodes>>["results"][number];
export type CharacterResult = Awaited<ReturnType<typeof searchCharacters>>["results"][number];
export type LoreResult = Awaited<ReturnType<typeof searchLore>>["results"][number];
export type { Segment };

async function findEpisodeJump(db: Database, input: string) {
  const number = episodeJump(input);
  if (number === null) return null;

  const [episode] = await db
    .select({ id: episodes.id, number: episodes.number, title: episodes.title })
    .from(episodes)
    .innerJoin(seasons, eq(episodes.seasonId, seasons.id))
    .where(and(eq(episodes.number, number), liveEpisode))
    .orderBy(asc(seasons.number))
    .limit(1);
  return episode ?? null;
}

/**
 * Each group is one query and they run together, so the whole search costs one
 * round trip. Scene filters only mean something for scenes, so they narrow to that.
 */
export async function runSearch(db: Database, input: string, options: SearchOptions & { type?: SearchType }) {
  const query = parseQuery(input);
  const { type } = options;
  if (isEmptyQuery(query)) {
    return { query, jump: null, scenes: empty, episodes: empty, characters: empty, lore: empty };
  }

  const wants = (group: SearchType) => (!type || type === group) && (group === "scenes" || (hasText(query) && !hasSceneFilter(query)));
  const nothing = Promise.resolve(empty);

  const [sceneGroup, episodeGroup, characterGroup, loreGroup, jump] = await Promise.all([
    wants("scenes") ? searchScenes(db, query, options) : nothing,
    wants("episodes") ? searchEpisodes(db, query, options) : nothing,
    wants("characters") ? searchCharacters(db, query, options) : nothing,
    wants("lore") ? searchLore(db, query, options) : nothing,
    findEpisodeJump(db, input),
  ]);

  return {
    query,
    jump,
    scenes: sceneGroup as { total: number; results: SceneResult[] },
    episodes: episodeGroup as { total: number; results: EpisodeResult[] },
    characters: characterGroup as { total: number; results: CharacterResult[] },
    lore: loreGroup as { total: number; results: LoreResult[] },
  };
}
