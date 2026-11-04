import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  characterImages,
  characterRelationships,
  characters,
  episodes,
  sceneCharacters,
  scenes,
  seasons,
  users,
} from "@/lib/db/schema";
import { VOICE_LABELS } from "@/lib/import/parse-beat";
import type { Database } from "@/lib/scenes/save-scene";
import { liveEpisode, liveScene } from "@/lib/db/live";
import { splitSpeakers } from "@/lib/script/scene-summary";
import { linesPerEpisode, speakersWithoutCards, summarizeAppearances } from "./stats";

const appearanceFields = {
  characterId: sceneCharacters.characterId,
  sceneId: sceneCharacters.sceneId,
  lineCount: sceneCharacters.lineCount,
  episodeId: episodes.id,
  episodeNumber: episodes.number,
  seasonNumber: seasons.number,
  position: scenes.position,
};

const fromAppearances = (db: Database) =>
  db
    .select(appearanceFields)
    .from(sceneCharacters)
    .innerJoin(scenes, eq(sceneCharacters.sceneId, scenes.id))
    .innerJoin(episodes, eq(scenes.episodeId, episodes.id))
    .innerJoin(seasons, eq(episodes.seasonId, seasons.id));

async function spokenNames(db: Database) {
  const beat = sql`jsonb_array_elements(${scenes.beats})`;
  const { rows } = (await db.execute(sql`
    select b->>'character' as character, count(*)::int as lines
    from ${scenes}
    join ${episodes} on ${scenes.episodeId} = ${episodes.id}
    cross join ${beat} as b
    where b->>'type' in ('dialogue', 'vo') and b->>'character' is not null and ${liveScene}
    group by 1
  `)) as unknown as { rows: { character: string; lines: number }[] };
  return rows;
}

/** One pass for the whole gallery, so no card runs a query of its own. */
export async function loadGallery(db: Database) {
  const [cards, appearances, spoken] = await Promise.all([
    db
      .select({
        id: characters.id,
        slug: characters.slug,
        name: characters.name,
        fullName: characters.fullName,
        aliases: characters.aliases,
        role: characters.role,
        gift: characters.gift,
        color: characters.color,
        portraitKey: characters.portraitKey,
        updatedAt: characters.updatedAt,
      })
      .from(characters),
    fromAppearances(db),
    spokenNames(db),
  ]);

  const statsFor = summarizeAppearances(appearances);
  const known = new Set(cards.flatMap(({ name, aliases }) => [name.toUpperCase(), ...aliases]));

  return {
    cards: cards.map((card) => ({ ...card, stats: statsFor(card.id) })),
    noCard: speakersWithoutCards(spoken, known, VOICE_LABELS, splitSpeakers),
  };
}

export type GalleryCard = Awaited<ReturnType<typeof loadGallery>>["cards"][number];

async function loadAppearances(db: Database, characterId: string) {
  const rows = await db
    .select({
      sceneId: scenes.id,
      kind: scenes.kind,
      title: scenes.title,
      position: scenes.position,
      lineCount: sceneCharacters.lineCount,
      episodeId: episodes.id,
      episodeNumber: episodes.number,
      episodeTitle: episodes.title,
      seasonNumber: seasons.number,
    })
    .from(sceneCharacters)
    .innerJoin(scenes, eq(sceneCharacters.sceneId, scenes.id))
    .innerJoin(episodes, eq(scenes.episodeId, episodes.id))
    .innerJoin(seasons, eq(episodes.seasonId, seasons.id))
    .where(eq(sceneCharacters.characterId, characterId))
    .orderBy(asc(seasons.number), asc(episodes.number), asc(scenes.position));

  const groups = new Map<string, { id: string; number: number; title: string; seasonNumber: number; lines: number; scenes: typeof rows }>();
  for (const row of rows) {
    const group = groups.get(row.episodeId) ?? {
      id: row.episodeId,
      number: row.episodeNumber,
      title: row.episodeTitle,
      seasonNumber: row.seasonNumber,
      lines: 0,
      scenes: [],
    };
    group.lines += row.lineCount;
    group.scenes.push(row);
    groups.set(row.episodeId, group);
  }

  return { rows, episodes: [...groups.values()] };
}

async function loadPartners(db: Database, characterId: string) {
  const other = alias(sceneCharacters, "other");

  return db
    .select({
      id: characters.id,
      slug: characters.slug,
      name: characters.name,
      color: characters.color,
      portraitKey: characters.portraitKey,
      updatedAt: characters.updatedAt,
      scenes: sql<number>`count(*)::int`,
    })
    .from(sceneCharacters)
    .innerJoin(other, and(eq(other.sceneId, sceneCharacters.sceneId), ne(other.characterId, characterId)))
    .innerJoin(characters, eq(other.characterId, characters.id))
    .where(eq(sceneCharacters.characterId, characterId))
    .groupBy(characters.id)
    .orderBy(desc(sql`count(*)`), asc(characters.name))
    .limit(6);
}

export async function loadCharacter(db: Database, slug: string) {
  const editor = alias(users, "editor");
  const [character] = await db
    .select({ character: characters, editedBy: editor.name })
    .from(characters)
    .leftJoin(editor, eq(characters.updatedBy, editor.id))
    .where(eq(characters.slug, slug))
    .limit(1);

  if (!character) return null;
  const { id } = character.character;

  const [appearances, seasonEpisodes, images, relationships, partners] = await Promise.all([
    loadAppearances(db, id),
    db
      .select({ seasonNumber: seasons.number, episodeNumber: episodes.number, title: episodes.title })
      .from(episodes)
      .innerJoin(seasons, eq(episodes.seasonId, seasons.id))
      .where(liveEpisode)
      .orderBy(asc(seasons.number), asc(episodes.number)),
    db
      .select()
      .from(characterImages)
      .where(eq(characterImages.characterId, id))
      .orderBy(asc(characterImages.position), asc(characterImages.id)),
    db
      .select({
        id: characterRelationships.id,
        note: characterRelationships.note,
        relatedId: characters.id,
        slug: characters.slug,
        name: characters.name,
        color: characters.color,
      })
      .from(characterRelationships)
      .innerJoin(characters, eq(characterRelationships.relatedId, characters.id))
      .where(eq(characterRelationships.characterId, id))
      .orderBy(asc(characterRelationships.position)),
    loadPartners(db, id),
  ]);

  return {
    ...character.character,
    editedBy: character.editedBy,
    appearances: appearances.episodes,
    first: appearances.rows[0] ?? null,
    last: appearances.rows.at(-1) ?? null,
    totalLines: appearances.rows.reduce((total, { lineCount }) => total + lineCount, 0),
    chart: linesPerEpisode(
      seasonEpisodes,
      appearances.rows.map(({ seasonNumber, episodeNumber, lineCount }) => ({ seasonNumber, episodeNumber, lineCount })),
    ),
    images,
    relationships,
    partners,
  };
}

export type CharacterDetail = NonNullable<Awaited<ReturnType<typeof loadCharacter>>>;

export async function loadCharacterChoices(db: Database) {
  return db
    .select({ id: characters.id, name: characters.name, slug: characters.slug })
    .from(characters)
    .orderBy(asc(characters.name));
}

export async function findCharacters(db: Database, ids: string[]) {
  if (ids.length === 0) return [];
  return db.select({ id: characters.id }).from(characters).where(inArray(characters.id, ids));
}
