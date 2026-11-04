import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";
import { liveScene } from "@/lib/db/live";
import {
  characterImages,
  characterRelationships,
  characters,
  episodes,
  sceneCharacters,
  scenes,
  seasons,
  series,
} from "@/lib/db/schema";
import type { Database } from "@/lib/scenes/save-scene";
import { speakerLineCounts } from "@/lib/script/scene-summary";
import { CHARACTER_COLORS } from "./colors";
import { slugify, uniqueSlug } from "./slug";
import { normalizeName, type CharacterFields } from "./validate";

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

export type CharacterSaveResult =
  | { status: "saved"; version: number }
  | { status: "conflict"; version: number }
  | { status: "name_taken"; name: string }
  | { status: "not_found" };

/** A database row can predate the version column's default. */
const versionOf = (row: { version: number | null }) => row.version ?? 1;

async function lockCharacter(tx: Transaction, id: string) {
  const [row] = await tx.select().from(characters).where(eq(characters.id, id)).for("update");
  return row ?? null;
}

async function seriesNames(tx: Transaction, seriesId: string, exceptId?: string) {
  const rows = await tx
    .select({ name: characters.name, aliases: characters.aliases })
    .from(characters)
    .where(exceptId ? and(eq(characters.seriesId, seriesId), ne(characters.id, exceptId)) : eq(characters.seriesId, seriesId));

  return new Set(rows.flatMap(({ name, aliases }) => [name.toUpperCase(), ...aliases]));
}

/** Rebuilds one character's appearances from the beats, by name and aliases. */
async function relink(tx: Transaction, characterId: string, seriesId: string, name: string, aliases: string[]) {
  const names = new Set([name.toUpperCase(), ...aliases]);
  const rows = await tx
    .select({ id: scenes.id, beats: scenes.beats })
    .from(scenes)
    .innerJoin(episodes, eq(scenes.episodeId, episodes.id))
    .innerJoin(seasons, eq(episodes.seasonId, seasons.id))
    .where(and(eq(seasons.seriesId, seriesId), liveScene));

  const links = rows.flatMap(({ id: sceneId, beats }) => {
    const lineCount = [...speakerLineCounts(beats)]
      .filter(([speaker]) => names.has(speaker))
      .reduce((total, [, count]) => total + count, 0);
    return lineCount > 0 ? [{ sceneId, characterId, lineCount }] : [];
  });

  await tx.delete(sceneCharacters).where(eq(sceneCharacters.characterId, characterId));
  if (links.length > 0) await tx.insert(sceneCharacters).values(links);
  return links.length;
}

async function replaceRelationships(tx: Transaction, characterId: string, relationships: CharacterFields["relationships"]) {
  await tx.delete(characterRelationships).where(eq(characterRelationships.characterId, characterId));

  const rows = relationships
    .filter(({ relatedId }) => relatedId !== characterId)
    .map(({ relatedId, note }, position) => ({ characterId, relatedId, note, position }));
  if (rows.length > 0) await tx.insert(characterRelationships).values(rows);
}

export async function createCharacter(
  db: Database,
  { name: rawName, fullName, userId }: { name: string; fullName: string | null; userId: string },
) {
  const name = normalizeName(rawName);

  return db.transaction(async (tx) => {
    const [owner] = await tx.select({ id: series.id }).from(series).orderBy(asc(series.title)).limit(1);
    if (!owner) return { status: "no_series" as const };

    if ((await seriesNames(tx, owner.id)).has(name)) return { status: "name_taken" as const, name };

    const taken = await tx.select({ slug: characters.slug }).from(characters);
    const slug = uniqueSlug(slugify(fullName ?? name), taken.map((row) => row.slug));
    const used = await tx.select({ id: characters.id }).from(characters).where(eq(characters.seriesId, owner.id));

    const [created] = await tx
      .insert(characters)
      .values({
        seriesId: owner.id,
        name,
        fullName,
        slug,
        color: CHARACTER_COLORS[used.length % CHARACTER_COLORS.length],
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .returning({ id: characters.id, slug: characters.slug });

    const linked = await relink(tx, created.id, owner.id, name, []);
    return { status: "created" as const, ...created, linked };
  });
}

export async function saveCharacter(
  db: Database,
  input: CharacterFields & { id: string; version: number; userId: string },
): Promise<CharacterSaveResult> {
  const { id, version, userId, relationships, ...fields } = input;

  return db.transaction(async (tx) => {
    const current = await lockCharacter(tx, id);
    if (!current) return { status: "not_found" };
    if (versionOf(current) !== version) return { status: "conflict", version: versionOf(current) };

    // Scripts still say the old name, so a rename keeps it as an alias.
    const wasRenamed = current.name !== fields.name;
    const aliases = [...new Set([...fields.aliases, ...(wasRenamed ? [current.name] : [])])]
      .filter((alias) => alias !== fields.name);

    const others = await seriesNames(tx, current.seriesId, id);
    const clash = [fields.name, ...aliases].find((name) => others.has(name));
    if (clash) return { status: "name_taken", name: clash };

    const next = versionOf(current) + 1;
    await tx
      .update(characters)
      .set({ ...fields, aliases, version: next, updatedBy: userId, updatedAt: new Date() })
      .where(eq(characters.id, id));
    await replaceRelationships(tx, id, relationships);

    const namesChanged = wasRenamed || aliases.join() !== current.aliases.join();
    if (namesChanged) await relink(tx, id, current.seriesId, fields.name, aliases);

    return { status: "saved", version: next };
  });
}

function mergedNotes(target: string | null, source: typeof characters.$inferSelect) {
  const kept = (
    [
      ["Full name", source.fullName],
      ["Role", source.role],
      ["Gift", source.gift],
      ["Appearance", source.appearance],
      ["Personality", source.personality],
      ["Backstory", source.backstory],
      ["Powers", source.powers],
      ["Notes", source.notes],
    ] as const
  ).filter(([, text]) => text);

  if (kept.length === 0) return target;

  const block = [`From ${source.name}:`, ...kept.map(([label, text]) => `${label}: ${text}`)].join("\n");
  return target ? `${target}\n\n${block}` : block;
}

/** Moves everything of one character into another, and keeps its name as an alias. */
export async function mergeCharacters(
  db: Database,
  { sourceId, targetId, version, userId }: { sourceId: string; targetId: string; version: number; userId: string },
) {
  if (sourceId === targetId) return { status: "same_character" as const };

  return db.transaction(async (tx) => {
    // A fixed lock order, so two opposite merges cannot deadlock.
    const [first, second] = [sourceId, targetId].sort();
    const locked = [await lockCharacter(tx, first), await lockCharacter(tx, second)];
    const source = locked.find((row) => row?.id === sourceId);
    const target = locked.find((row) => row?.id === targetId);

    if (!source || !target) return { status: "not_found" as const };
    if (versionOf(source) !== version) return { status: "conflict" as const, version: versionOf(source) };

    const aliases = [...new Set([...target.aliases, source.name.toUpperCase(), ...source.aliases])]
      .filter((alias) => alias !== target.name.toUpperCase());

    await tx
      .update(characterImages)
      .set({ characterId: targetId, position: sql`${characterImages.position} + 1000` })
      .where(eq(characterImages.characterId, sourceId));

    const theirs = await tx.select().from(characterRelationships).where(eq(characterRelationships.characterId, sourceId));
    const ours = await tx.select().from(characterRelationships).where(eq(characterRelationships.characterId, targetId));
    const hasLink = new Set(ours.map(({ relatedId }) => relatedId));
    const toMove = theirs.filter(({ relatedId }) => relatedId !== targetId && !hasLink.has(relatedId));
    if (toMove.length > 0) {
      await tx
        .update(characterRelationships)
        .set({ characterId: targetId })
        .where(inArray(characterRelationships.id, toMove.map(({ id }) => id)));
    }

    // Links pointing at the old card follow it, unless that would duplicate one.
    const incoming = await tx.select().from(characterRelationships).where(eq(characterRelationships.relatedId, sourceId));
    const pointing = await tx.select().from(characterRelationships).where(eq(characterRelationships.relatedId, targetId));
    const alreadyPoints = new Set(pointing.map(({ characterId }) => characterId));
    const toRepoint = incoming.filter(
      ({ characterId }) => characterId !== targetId && !alreadyPoints.has(characterId),
    );
    if (toRepoint.length > 0) {
      await tx
        .update(characterRelationships)
        .set({ relatedId: targetId })
        .where(inArray(characterRelationships.id, toRepoint.map(({ id }) => id)));
    }

    await tx
      .update(characters)
      .set({
        aliases,
        portraitKey: target.portraitKey ?? source.portraitKey,
        notes: mergedNotes(target.notes, source),
        version: versionOf(target) + 1,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(characters.id, targetId));

    await tx.delete(characters).where(eq(characters.id, sourceId));
    await relink(tx, targetId, target.seriesId, target.name, aliases);

    return { status: "merged" as const, slug: target.slug };
  });
}

/** Refuses while any scene still credits them, whatever the browser thought. */
export async function deleteCharacter(db: Database, id: string) {
  return db.transaction(async (tx) => {
    const current = await lockCharacter(tx, id);
    if (!current) return { status: "not_found" as const };

    const [{ count }] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(sceneCharacters)
      .where(eq(sceneCharacters.characterId, id));
    if (count > 0) return { status: "has_appearances" as const, count };

    await tx.delete(characters).where(eq(characters.id, id));
    return { status: "deleted" as const };
  });
}

/** Leaves the version alone, so a new portrait never makes an open editor look stale. */
export async function setPortrait(db: Database, id: string, portraitKey: string, userId: string) {
  await db
    .update(characters)
    .set({ portraitKey, updatedBy: userId, updatedAt: new Date() })
    .where(eq(characters.id, id));
}

export async function addImage(db: Database, characterId: string, r2Key: string, caption: string | null) {
  const [{ next }] = await db
    .select({ next: sql<number>`coalesce(max(${characterImages.position}), -1)::int + 1` })
    .from(characterImages)
    .where(eq(characterImages.characterId, characterId));

  const [image] = await db
    .insert(characterImages)
    .values({ characterId, r2Key, caption, position: next })
    .returning();
  return image;
}

export async function updateImageCaption(db: Database, characterId: string, imageId: string, caption: string | null) {
  await db
    .update(characterImages)
    .set({ caption })
    .where(and(eq(characterImages.id, imageId), eq(characterImages.characterId, characterId)));
}

export async function deleteImage(db: Database, characterId: string, imageId: string) {
  await db
    .delete(characterImages)
    .where(and(eq(characterImages.id, imageId), eq(characterImages.characterId, characterId)));
}

export async function reorderImages(db: Database, characterId: string, ids: string[]) {
  await db.transaction(async (tx) => {
    for (const [position, id] of ids.entries()) {
      await tx
        .update(characterImages)
        .set({ position })
        .where(and(eq(characterImages.id, id), eq(characterImages.characterId, characterId)));
    }
  });
}

