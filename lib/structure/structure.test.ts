import { asc, eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import {
  characters,
  episodes,
  sceneCharacters,
  sceneRevisions,
  scenes,
  seasons,
  series,
  users,
  type Beat,
} from "@/lib/db/schema";
import { loadCharacter, loadGallery } from "@/lib/characters/read";
import { saveCharacter } from "@/lib/characters/write";
import { getSavedScene, saveScene, updateSceneDetails } from "@/lib/scenes/save-scene";
import { createTestDb } from "@/lib/scenes/test-db";
import {
  deleteEpisode,
  reorderScenes,
  restoreEpisode,
  updateEpisode,
} from "./episode";
import { addScene, deleteScene, duplicateScene, moveScene, restoreScene } from "./scene";
import { createEpisode, listDeleted, purgeExpired, reorderEpisodes, updateSeason } from "./season";

type Db = Awaited<ReturnType<typeof createTestDb>>;

const line = (character: string, text = "Hello"): Beat => ({ id: crypto.randomUUID(), type: "dialogue", character, text });

async function seed(db: Db) {
  const [user] = await db.insert(users).values({ email: "dean@example.com", name: "Dean", passwordHash: "x" }).returning();
  const [{ id: seriesId }] = await db.insert(series).values({ title: "Test" }).returning();
  const [season] = await db.insert(seasons).values({ seriesId, number: 1 }).returning();
  const [first, second, third] = await db
    .insert(episodes)
    .values([1, 2, 3].map((number) => ({ seasonId: season.id, number, title: `Episode ${number}` })))
    .returning();
  const [a, b, c] = await db
    .insert(scenes)
    .values(
      ["A", "B", "C"].map((title, index) => ({
        episodeId: first.id,
        position: index + 1,
        title,
        beats: [line("REVOC")],
      })),
    )
    .returning();
  const [revoc] = await db.insert(characters).values({ seriesId, name: "REVOC", slug: "revoc" }).returning();
  await db.insert(sceneCharacters).values([a, b, c].map(({ id }) => ({ sceneId: id, characterId: revoc.id, lineCount: 1 })));

  return { user, season, first, second, third, a, b, c, revoc };
}

const sceneOrder = async (db: Db, episodeId: string) =>
  (
    await db
      .select({ title: scenes.title, position: scenes.position })
      .from(scenes)
      .where(sql`${scenes.episodeId} = ${episodeId} and ${scenes.deletedAt} is null`)
      .orderBy(asc(scenes.position))
  ).map(({ title }) => title);

const episodeNumbers = async (db: Db, seasonId: string) =>
  (
    await db
      .select({ title: episodes.title, number: episodes.number })
      .from(episodes)
      .where(sql`${episodes.seasonId} = ${seasonId} and ${episodes.deletedAt} is null`)
      .orderBy(asc(episodes.number))
  ).map(({ title, number }) => `${number}:${title}`);

const linkCount = async (db: Db, characterId: string) =>
  (await db.select().from(sceneCharacters).where(eq(sceneCharacters.characterId, characterId))).length;

let db: Db;
let world: Awaited<ReturnType<typeof seed>>;

beforeEach(async () => {
  db = await createTestDb();
  world = await seed(db);
});

describe("episode list", () => {
  it("renumbers on reorder and keeps a gap in the numbering", async () => {
    const { season, first, second, third } = world;
    await db.update(episodes).set({ number: 7 }).where(eq(episodes.id, third.id));

    const result = await reorderEpisodes(db, {
      seasonId: season.id,
      version: 1,
      ids: [third.id, first.id, second.id],
    });

    expect(result).toMatchObject({ status: "ok", version: 2 });
    expect(await episodeNumbers(db, season.id)).toEqual(["1:Episode 3", "2:Episode 1", "7:Episode 2"]);
  });

  it("does not count a reorder as an edit to any episode", async () => {
    const { season, first, second, third } = world;
    await reorderEpisodes(db, { seasonId: season.id, version: 1, ids: [third.id, second.id, first.id] });

    const rows = await db.select({ version: episodes.version }).from(episodes);
    expect(rows.every(({ version }) => version === 1)).toBe(true);
  });

  it("refuses a stale version and changes nothing", async () => {
    const { season, first, second, third } = world;
    const result = await reorderEpisodes(db, { seasonId: season.id, version: 9, ids: [third.id, second.id, first.id] });

    expect(result.status).toBe("conflict");
    expect(await episodeNumbers(db, season.id)).toEqual(["1:Episode 1", "2:Episode 2", "3:Episode 3"]);
  });

  it("refuses an order that misses an episode someone else added", async () => {
    const { season, first, second } = world;
    const result = await reorderEpisodes(db, { seasonId: season.id, version: 1, ids: [second.id, first.id] });
    expect(result.status).toBe("conflict");
  });

  it("creates an episode with a free number and refuses a taken one", async () => {
    const { season } = world;
    expect(await createEpisode(db, { seasonId: season.id, version: 1, number: 9, title: "New" })).toMatchObject({
      status: "ok",
      version: 2,
    });
    expect(await createEpisode(db, { seasonId: season.id, version: 2, number: 2, title: "Clash" })).toEqual({
      status: "number_taken",
      number: 2,
    });
  });

  it("stores a season title that may be empty, and a summary", async () => {
    const { season } = world;
    await updateSeason(db, { seasonId: season.id, version: 1, title: null, summary: "Everything changes." });

    const [row] = await db.select().from(seasons).where(eq(seasons.id, season.id));
    expect(row).toMatchObject({ title: null, summary: "Everything changes.", version: 2 });
  });
});

describe("episode edits", () => {
  it("changes only the fields it was given", async () => {
    const { first } = world;
    await updateEpisode(db, { episodeId: first.id, version: 1, patch: { status: "done" } });
    await updateEpisode(db, { episodeId: first.id, version: 2, patch: { summary: "Sum", openingTheme: "Song" } });

    const [row] = await db.select().from(episodes).where(eq(episodes.id, first.id));
    expect(row).toMatchObject({ status: "done", summary: "Sum", openingTheme: "Song", title: "Episode 1", version: 3 });
  });

  it("shows a conflict to the second of two people", async () => {
    const { first } = world;
    await updateEpisode(db, { episodeId: first.id, version: 1, patch: { title: "Mine" } });
    const late = await updateEpisode(db, { episodeId: first.id, version: 1, patch: { title: "Theirs" } });

    expect(late.status).toBe("conflict");
    const [row] = await db.select().from(episodes).where(eq(episodes.id, first.id));
    expect(row.title).toBe("Mine");
  });
});

describe("soft delete: episodes", () => {
  it("hides the episode, frees its number and drops its links", async () => {
    const { season, first, revoc, user } = world;
    const result = await deleteEpisode(db, { episodeId: first.id, version: 1, userId: user.id });

    expect(result).toEqual({ status: "ok", seasonVersion: 2 });
    expect(await episodeNumbers(db, season.id)).toEqual(["2:Episode 2", "3:Episode 3"]);
    expect(await linkCount(db, revoc.id)).toBe(0);
    expect(await createEpisode(db, { seasonId: season.id, version: 2, number: 1, title: "Replacement" })).toMatchObject({
      status: "ok",
    });
  });

  it("restores the episode with its scenes and links", async () => {
    const { season, first, revoc, user } = world;
    await deleteEpisode(db, { episodeId: first.id, version: 1, userId: user.id });
    const result = await restoreEpisode(db, { episodeId: first.id, version: 1 });

    expect(result).toEqual({ status: "ok", number: 1, renumbered: false, seasonVersion: 3 });
    expect(await episodeNumbers(db, season.id)).toContain("1:Episode 1");
    expect(await sceneOrder(db, first.id)).toEqual(["A", "B", "C"]);
    expect(await linkCount(db, revoc.id)).toBe(3);
  });

  it("restores to the end when its number was taken meanwhile", async () => {
    const { season, first, user } = world;
    await deleteEpisode(db, { episodeId: first.id, version: 1, userId: user.id });
    await createEpisode(db, { seasonId: season.id, version: 2, number: 1, title: "Replacement" });

    expect(await restoreEpisode(db, { episodeId: first.id, version: 1 })).toMatchObject({ number: 4, renumbered: true });
  });

  it("keeps a scene deleted on its own deleted when the episode comes back", async () => {
    const { first, a, revoc, user } = world;
    await deleteScene(db, { sceneId: a.id, version: 1, userId: user.id });
    await deleteEpisode(db, { episodeId: first.id, version: 1, userId: user.id });
    await restoreEpisode(db, { episodeId: first.id, version: 1 });

    expect(await sceneOrder(db, first.id)).toEqual(["B", "C"]);
    expect(await linkCount(db, revoc.id)).toBe(2);
  });

  it("stops saves to a scene inside a deleted episode", async () => {
    const { first, a, user } = world;
    await deleteEpisode(db, { episodeId: first.id, version: 1, userId: user.id });

    const save = await saveScene(db, {
      sceneId: a.id,
      userId: user.id,
      version: 1,
      title: "x",
      timecode: null,
      location: null,
      beats: [],
    });
    expect(save.status).toBe("not_found");
    expect(await getSavedScene(db, a.id)).toBeNull();
  });

  it("refuses a second restore", async () => {
    const { first, user } = world;
    await deleteEpisode(db, { episodeId: first.id, version: 1, userId: user.id });
    await restoreEpisode(db, { episodeId: first.id, version: 1 });

    expect((await restoreEpisode(db, { episodeId: first.id, version: 1 })).status).toBe("conflict");
  });
});

describe("soft delete: scenes", () => {
  it("hides the scene, drops its links and writes no revision", async () => {
    const { first, b, revoc, user } = world;
    await deleteScene(db, { sceneId: b.id, version: 1, userId: user.id });

    expect(await sceneOrder(db, first.id)).toEqual(["A", "C"]);
    expect(await linkCount(db, revoc.id)).toBe(2);
    expect(await db.select().from(sceneRevisions)).toEqual([]);
  });

  it("puts the scene back where it was, with its links and version", async () => {
    const { first, b, revoc, user } = world;
    await deleteScene(db, { sceneId: b.id, version: 1, userId: user.id });
    expect(await restoreScene(db, { sceneId: b.id, version: 1 })).toMatchObject({ status: "ok" });

    expect(await sceneOrder(db, first.id)).toEqual(["A", "B", "C"]);
    expect(await linkCount(db, revoc.id)).toBe(3);
    const [row] = await db.select({ version: scenes.version }).from(scenes).where(eq(scenes.id, b.id));
    expect(row.version).toBe(1);
  });

  it("uses a character's aliases when links come back", async () => {
    const { b, revoc, user } = world;
    await deleteScene(db, { sceneId: b.id, version: 1, userId: user.id });
    await db.update(characters).set({ name: "REVOCUS", aliases: ["REVOC"] }).where(eq(characters.id, revoc.id));
    await restoreScene(db, { sceneId: b.id, version: 1 });

    expect(await linkCount(db, revoc.id)).toBe(3);
  });

  it("refuses to restore into a deleted episode", async () => {
    const { first, a, user } = world;
    await deleteScene(db, { sceneId: a.id, version: 1, userId: user.id });
    await deleteEpisode(db, { episodeId: first.id, version: 1, userId: user.id });

    expect(await restoreScene(db, { sceneId: a.id, version: 1 })).toEqual({ status: "episode_deleted", number: 1 });
  });

  it("refuses to delete a scene someone has just changed", async () => {
    const { a, user } = world;
    const result = await deleteScene(db, { sceneId: a.id, version: 5, userId: user.id });
    expect(result.status).toBe("conflict");
  });
});

describe("character pages while a scene is deleted", () => {
  it("leaves a speaker from a deleted scene out of No card yet", async () => {
    const { a, user } = world;
    await db.update(scenes).set({ beats: [line("STRANGER")] }).where(eq(scenes.id, a.id));
    expect((await loadGallery(db)).noCard.map(({ name }) => name)).toContain("STRANGER");

    await deleteScene(db, { sceneId: a.id, version: 1, userId: user.id });
    expect((await loadGallery(db)).noCard.map(({ name }) => name)).not.toContain("STRANGER");
  });

  it("does the same for a deleted episode", async () => {
    const { first, a, user } = world;
    await db.update(scenes).set({ beats: [line("STRANGER")] }).where(eq(scenes.id, a.id));
    await deleteEpisode(db, { episodeId: first.id, version: 1, userId: user.id });

    expect((await loadGallery(db)).noCard).toEqual([]);
  });

  it("does not link a deleted scene back when a character is renamed", async () => {
    const { a, revoc, user } = world;
    await deleteScene(db, { sceneId: a.id, version: 1, userId: user.id });

    const saved = await saveCharacter(db, {
      id: revoc.id,
      version: 1,
      userId: user.id,
      name: "REVOCUS",
      fullName: null,
      role: null,
      gift: null,
      appearance: null,
      personality: null,
      backstory: null,
      powers: null,
      notes: null,
      color: null,
      aliases: [],
      relationships: [],
    });
    expect(saved.status).toBe("saved");
    expect(await linkCount(db, revoc.id)).toBe(2);
  });

  it("counts only live scenes on the character page", async () => {
    const { first, second, b, revoc, user } = world;
    await moveScene(db, { sceneId: b.id, targetEpisodeId: second.id, version: 1 });
    await deleteEpisode(db, { episodeId: second.id, version: 1, userId: user.id });

    const character = await loadCharacter(db, revoc.slug);
    expect(character?.totalLines).toBe(2);
    expect(character?.appearances.map(({ id }) => id)).toEqual([first.id]);
    expect(character?.chart.map(({ episodeNumber }) => episodeNumber)).toEqual([1, 3]);
  });
});

describe("recently deleted", () => {
  const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  it("lists deleted episodes and scenes with who deleted them", async () => {
    const { season, second, a, user } = world;
    await deleteEpisode(db, { episodeId: second.id, version: 1, userId: user.id });
    await deleteScene(db, { sceneId: a.id, version: 1, userId: user.id });

    const list = await listDeleted(db, season.id);
    expect(list.episodes).toMatchObject([{ id: second.id, deletedBy: "Dean", sceneCount: 0 }]);
    expect(list.scenes).toMatchObject([{ id: a.id, episodeNumber: 1, deletedBy: "Dean" }]);
  });

  it("drops rows older than 30 days from the list, and refuses to restore them", async () => {
    const { season, second, a } = world;
    await db.update(episodes).set({ deletedAt: daysAgo(31) }).where(eq(episodes.id, second.id));
    await db.update(scenes).set({ deletedAt: daysAgo(31) }).where(eq(scenes.id, a.id));

    const list = await listDeleted(db, season.id);
    expect(list.episodes).toEqual([]);
    expect(list.scenes).toEqual([]);
    expect((await restoreEpisode(db, { episodeId: second.id, version: 1 })).status).toBe("not_found");
    expect((await restoreScene(db, { sceneId: a.id, version: 1 })).status).toBe("not_found");
  });

  it("purges only what has expired", async () => {
    const { first, a, b } = world;
    await db.update(scenes).set({ deletedAt: daysAgo(31) }).where(eq(scenes.id, a.id));
    await db.update(scenes).set({ deletedAt: daysAgo(29) }).where(eq(scenes.id, b.id));

    await db.transaction((tx) => purgeExpired(tx));

    const rows = await db.select({ title: scenes.title }).from(scenes).where(eq(scenes.episodeId, first.id));
    expect(rows.map(({ title }) => title).sort()).toEqual(["B", "C"]);
  });
});

describe("scene order", () => {
  it("rewrites positions, no revisions, no version change", async () => {
    const { first, a, b, c } = world;
    const result = await reorderScenes(db, { episodeId: first.id, version: 1, ids: [c.id, a.id, b.id] });

    expect(result).toEqual({ status: "ok", version: 2 });
    expect(await sceneOrder(db, first.id)).toEqual(["C", "A", "B"]);
    expect(await db.select().from(sceneRevisions)).toEqual([]);
    const rows = await db.select({ version: scenes.version, updatedAt: scenes.updatedAt }).from(scenes);
    expect(rows.every(({ version }) => version === 1)).toBe(true);
    expect(rows.map(({ updatedAt }) => updatedAt)).toEqual([a, b, c].map(({ updatedAt }) => updatedAt));
  });

  it("leaves an open editor's save working after a reorder", async () => {
    const { first, a, b, c, user } = world;
    await reorderScenes(db, { episodeId: first.id, version: 1, ids: [c.id, b.id, a.id] });

    const save = await saveScene(db, {
      sceneId: a.id,
      userId: user.id,
      version: 1,
      title: "Edited",
      timecode: null,
      location: null,
      beats: [],
    });
    expect(save.status).toBe("saved");
  });

  it("refuses a stale list version", async () => {
    const { first, a, b, c } = world;
    expect((await reorderScenes(db, { episodeId: first.id, version: 4, ids: [c.id, a.id, b.id] })).status).toBe("conflict");
    expect(await sceneOrder(db, first.id)).toEqual(["A", "B", "C"]);
  });

  it("adds a scene at the top, in the middle and at the end", async () => {
    const { first, b, c, user } = world;
    const common = { episodeId: first.id, kind: "scene" as const, userId: user.id };

    await addScene(db, { ...common, version: 1, afterId: null, title: "Top" });
    await addScene(db, { ...common, version: 2, afterId: b.id, title: "Middle" });
    await addScene(db, { ...common, version: 3, afterId: c.id, title: "End" });

    expect(await sceneOrder(db, first.id)).toEqual(["Top", "A", "B", "Middle", "C", "End"]);
  });

  it("gives a new scene no import key", async () => {
    const { first, user } = world;
    const result = await addScene(db, {
      episodeId: first.id,
      version: 1,
      kind: "post_credit",
      title: null,
      afterId: null,
      userId: user.id,
    });
    if (result.status !== "ok") throw new Error(result.status);

    const [row] = await db.select().from(scenes).where(eq(scenes.id, result.scene.id));
    expect(row).toMatchObject({ importKey: null, importSeasonId: null, kind: "post_credit", version: 1 });
  });
});

describe("duplicate", () => {
  it("copies the beats next to the original, with links and no import key", async () => {
    const { first, a, revoc, user } = world;
    await db.update(scenes).set({ importKey: "e1:s1", importSeasonId: world.season.id }).where(eq(scenes.id, a.id));

    const result = await duplicateScene(db, { sceneId: a.id, version: 1, userId: user.id });
    if (result.status !== "ok") throw new Error(result.status);

    expect(await sceneOrder(db, first.id)).toEqual(["A", "A (copy)", "B", "C"]);
    expect(await linkCount(db, revoc.id)).toBe(4);

    const [copy] = await db.select().from(scenes).where(eq(scenes.id, result.scene.id));
    expect(copy).toMatchObject({ importKey: null, version: 1 });
    expect(copy.beats[0].id).not.toBe(a.beats[0].id);
    expect(copy.beats[0].text).toBe(a.beats[0].text);
  });
});

describe("move to another episode", () => {
  it("goes to the end of the target and keeps its links, version and key", async () => {
    const { first, second, a, revoc } = world;
    await db.update(scenes).set({ importKey: "e1:s1", importSeasonId: world.season.id }).where(eq(scenes.id, a.id));
    await db.insert(scenes).values({ episodeId: second.id, position: 1, title: "Z" });

    const result = await moveScene(db, { sceneId: a.id, targetEpisodeId: second.id, version: 1 });

    expect(result).toMatchObject({ status: "ok", version: 2, targetNumber: 2 });
    expect(await sceneOrder(db, first.id)).toEqual(["B", "C"]);
    expect(await sceneOrder(db, second.id)).toEqual(["Z", "A"]);
    expect(await linkCount(db, revoc.id)).toBe(3);

    const [row] = await db.select().from(scenes).where(eq(scenes.id, a.id));
    expect(row).toMatchObject({ version: 1, importKey: "e1:s1" });
    expect(await db.select().from(sceneRevisions)).toEqual([]);
  });

  it("moves both episodes' list versions on", async () => {
    const { first, second, a } = world;
    await moveScene(db, { sceneId: a.id, targetEpisodeId: second.id, version: 1 });

    const rows = await db.select({ id: episodes.id, scenesVersion: episodes.scenesVersion }).from(episodes);
    expect(rows.find(({ id }) => id === first.id)?.scenesVersion).toBe(2);
    expect(rows.find(({ id }) => id === second.id)?.scenesVersion).toBe(2);
  });

  it("refuses a stale source list, and a deleted target", async () => {
    const { second, a, user } = world;
    expect((await moveScene(db, { sceneId: a.id, targetEpisodeId: second.id, version: 7 })).status).toBe("conflict");

    await deleteEpisode(db, { episodeId: second.id, version: 1, userId: user.id });
    expect((await moveScene(db, { sceneId: a.id, targetEpisodeId: second.id, version: 1 })).status).toBe("not_found");
  });

  it("refuses another season", async () => {
    const { season, a } = world;
    const [other] = await db.insert(seasons).values({ seriesId: season.seriesId, number: 2 }).returning();
    const [target] = await db.insert(episodes).values({ seasonId: other.id, number: 1, title: "Elsewhere" }).returning();

    expect((await moveScene(db, { sceneId: a.id, targetEpisodeId: target.id, version: 1 })).status).toBe("not_found");
  });
});

describe("scene details", () => {
  it("renames and changes kind as an edit, kept in history", async () => {
    const { a, user } = world;
    const result = await updateSceneDetails(db, { sceneId: a.id, userId: user.id, version: 1, title: "New", kind: "outro" });

    expect(result).toEqual({ status: "saved", version: 2 });
    const [row] = await db.select().from(scenes).where(eq(scenes.id, a.id));
    expect(row).toMatchObject({ title: "New", kind: "outro", version: 2 });
    expect(row.beats).toHaveLength(1);
    expect(await db.select().from(sceneRevisions)).toHaveLength(1);
  });

  it("does nothing when nothing changed", async () => {
    const { a, user } = world;
    await updateSceneDetails(db, { sceneId: a.id, userId: user.id, version: 1, title: "A", kind: "scene" });
    expect(await db.select().from(sceneRevisions)).toEqual([]);
  });

  it("conflicts with an edit made first", async () => {
    const { a, user } = world;
    const late = await updateSceneDetails(db, { sceneId: a.id, userId: user.id, version: 3, title: "X", kind: "scene" });
    expect(late.status).toBe("conflict");
  });
});
