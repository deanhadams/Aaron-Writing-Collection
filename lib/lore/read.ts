import { and, asc, desc, eq, isNull, ne, sql } from "drizzle-orm";
import { characters, episodes, loreEntries, scenes, users } from "@/lib/db/schema";
import { liveScene } from "@/lib/db/live";
import type { Database } from "@/lib/scenes/save-scene";
import { lexemes, toTsQuery } from "@/lib/search/query";
import { buildLinkLookup, linkKey, parseWikiLinks } from "./links";

const MENTION_LIMIT = 20;

export async function loadLoreGallery(db: Database) {
  return db
    .select({
      id: loreEntries.id,
      slug: loreEntries.slug,
      title: loreEntries.title,
      category: loreEntries.category,
      summary: loreEntries.summary,
      coverKey: loreEntries.coverKey,
      tags: loreEntries.tags,
      updatedAt: loreEntries.updatedAt,
      editor: users.name,
    })
    .from(loreEntries)
    .leftJoin(users, eq(loreEntries.updatedBy, users.id))
    .where(isNull(loreEntries.deletedAt))
    .orderBy(asc(loreEntries.title));
}

export type LoreCardData = Awaited<ReturnType<typeof loadLoreGallery>>[number];

/** Everything a [[link]] can point at, for chips and for the autocomplete. */
export async function loadLinkTargets(db: Database) {
  const [cast, entries] = await Promise.all([
    db
      .select({
        name: characters.name,
        fullName: characters.fullName,
        aliases: characters.aliases,
        slug: characters.slug,
        color: characters.color,
      })
      .from(characters)
      .orderBy(asc(characters.name)),
    db
      .select({ title: loreEntries.title, aliases: loreEntries.aliases, slug: loreEntries.slug })
      .from(loreEntries)
      .where(isNull(loreEntries.deletedAt))
      .orderBy(asc(loreEntries.title)),
  ]);
  return { characters: cast, entries };
}

export async function loadEntry(db: Database, slug: string) {
  const [entry] = await db
    .select({
      id: loreEntries.id,
      slug: loreEntries.slug,
      title: loreEntries.title,
      category: loreEntries.category,
      summary: loreEntries.summary,
      body: loreEntries.body,
      coverKey: loreEntries.coverKey,
      tags: loreEntries.tags,
      aliases: loreEntries.aliases,
      version: loreEntries.version,
      updatedAt: loreEntries.updatedAt,
      editor: users.name,
    })
    .from(loreEntries)
    .leftJoin(users, eq(loreEntries.updatedBy, users.id))
    .where(and(eq(loreEntries.slug, slug), isNull(loreEntries.deletedAt)));
  return entry ?? null;
}

/** Scenes that say the entry's title or an alias, as whole words in order. */
export async function loadMentions(db: Database, names: string[]) {
  const phrases = names.map(lexemes).filter((words) => words.length > 0).map((words) => toTsQuery(words, false));
  if (phrases.length === 0) return [];

  const query = sql`to_tsquery('simple', ${phrases.join(" | ")})`;
  const text = sql`to_tsvector('simple', ${scenes.searchText})`;

  return db
    .select({
      id: scenes.id,
      kind: scenes.kind,
      title: scenes.title,
      episodeNumber: episodes.number,
      episodeTitle: episodes.title,
    })
    .from(scenes)
    .innerJoin(episodes, eq(scenes.episodeId, episodes.id))
    .where(and(liveScene, sql`${text} @@ ${query}`))
    .orderBy(desc(sql`ts_rank(${text}, ${query})`), asc(episodes.number), asc(scenes.position))
    .limit(MENTION_LIMIT);
}

/** Entries this one links to, and entries whose text links here. */
export async function loadRelated(db: Database, entry: { id: string; title: string; body: string; aliases: string[] }) {
  const others = await db
    .select({
      slug: loreEntries.slug,
      title: loreEntries.title,
      body: loreEntries.body,
      aliases: loreEntries.aliases,
    })
    .from(loreEntries)
    .where(and(isNull(loreEntries.deletedAt), ne(loreEntries.id, entry.id)))
    .orderBy(asc(loreEntries.title));

  const outgoing = new Set(parseWikiLinks(entry.body).map(({ target }) => linkKey(target)));
  const ownNames = new Set([entry.title, ...entry.aliases].map(linkKey));

  const related = others.flatMap(({ slug, title, body, aliases }) => {
    const isLinkedFromHere = [title, ...aliases].some((name) => outgoing.has(linkKey(name)));
    const linksHere = parseWikiLinks(body).some(({ target }) => ownNames.has(linkKey(target)));
    return isLinkedFromHere || linksHere ? [{ slug, title, isLinkedFromHere, linksHere }] : [];
  });

  return related;
}

export async function loadLinkLookup(db: Database) {
  return buildLinkLookup(await loadLinkTargets(db));
}
