import { and, asc, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { mergeCharacters } from "@/lib/characters/write";
import { characters, episodes, sceneCharacters, scenes, seasons, users, type Beat } from "@/lib/db/schema";
import { saveScene } from "@/lib/scenes/save-scene";
import { createTestDb } from "@/lib/scenes/test-db";
import { deleteEpisode, reorderScenes, restoreEpisode, updateEpisode } from "@/lib/structure/episode";
import { addScene, deleteScene, moveScene } from "@/lib/structure/scene";
import { createEpisode, reorderEpisodes } from "@/lib/structure/season";
import { seedCharacters } from "./characters";
import type { ParsedEpisode, ParsedScene, ParsedScript } from "./parse-script";
import { writeImport } from "./write-import";

type Db = Awaited<ReturnType<typeof createTestDb>>;

const say = (character: string, text: string): Beat => ({ id: crypto.randomUUID(), type: "dialogue", character, text });

const parsedScene = (position: number, text: string, character = "REVOC"): ParsedScene => ({
  position,
  kind: "scene",
  title: `Scene ${position}`,
  timecode: null,
  location: null,
  beats: [say(character, text)],
});

const parsedEpisode = (number: number, scenes: ParsedScene[], title = `Episode ${number}`): ParsedEpisode => ({
  number,
  title,
  openingTheme: null,
  outroTheme: null,
  scenes,
});

const script = (episodeList: ParsedEpisode[]): ParsedScript => ({
  seasonNumber: 1,
  episodes: episodeList,
  warnings: [],
  ignoredLines: [],
  repeatedSeasonHeadings: 0,
  droppedEndLines: 0,
});

const twoEpisodes = () =>
  script([
    parsedEpisode(1, [parsedScene(1, "One"), parsedScene(2, "Two"), parsedScene(3, "Three")]),
    parsedEpisode(2, [parsedScene(1, "Four")]),
  ]);

const run = (db: Db, parsed: ParsedScript, force = false) =>
  db.transaction((tx) =>
    writeImport(tx, parsed, seedCharacters(parsed), { force, removeSample: false, seriesTitle: "Test" }),
  );

const firstText = (scene: { beats: Beat[] }) => scene.beats[0]?.text;

async function season(db: Db) {
  const [row] = await db.select().from(seasons);
  const list = await db.select().from(episodes).orderBy(asc(episodes.number));
  return { id: row.id, version: row.version, first: list[0], second: list[1] };
}

const liveScenes = (db: Db, episodeId: string) =>
  db
    .select()
    .from(scenes)
    .where(eq(scenes.episodeId, episodeId))
    .orderBy(asc(scenes.position));

let db: Db;
let userId: string;

async function mustReorder(input: Parameters<typeof reorderScenes>[1]) {
  expect((await reorderScenes(db, input)).status).toBe("ok");
}

beforeEach(async () => {
  db = await createTestDb();
  [{ id: userId }] = await db
    .insert(users)
    .values({ email: "dean@example.com", name: "Dean", passwordHash: "x" })
    .returning();
});

describe("import keys", () => {
  it("writes a key on every episode and scene", async () => {
    await run(db, twoEpisodes());
    const { first } = await season(db);

    expect(first.importKey).toBe("e1");
    expect((await liveScenes(db, first.id)).map(({ importKey }) => importKey)).toEqual(["e1:s1", "e1:s2", "e1:s3"]);
  });

  it("changes nothing on a repeat run", async () => {
    await run(db, twoEpisodes());
    expect(await run(db, twoEpisodes())).toMatchObject({ scenesInserted: 0, scenesUpdated: 0, scenesUnchanged: 4, scenesExtra: [] });
  });
});

describe("re-import after changes on the site", () => {
  it("keeps a site reorder, and updates each scene by its own key", async () => {
    await run(db, twoEpisodes());
    const { first } = await season(db);
    const [one, two, three] = await liveScenes(db, first.id);
    await mustReorder({ episodeId: first.id, version: first.scenesVersion, ids: [three.id, one.id, two.id] });

    const changed = script([
      parsedEpisode(1, [parsedScene(1, "One"), parsedScene(2, "Two changed"), parsedScene(3, "Three")]),
      parsedEpisode(2, [parsedScene(1, "Four")]),
    ]);
    const result = await run(db, changed);

    expect(result).toMatchObject({ scenesInserted: 0, scenesUpdated: 1, scenesUnchanged: 3 });
    expect((await liveScenes(db, first.id)).map(firstText)).toEqual(["Three", "One", "Two changed"]);
  });

  it("ignores a scene inserted on the site, which would have shifted positions", async () => {
    await run(db, twoEpisodes());
    const { first } = await season(db);
    await addScene(db, { episodeId: first.id, version: first.scenesVersion, afterId: null, kind: "scene", title: "Mine", userId });

    const result = await run(db, twoEpisodes());

    expect(result).toMatchObject({ scenesInserted: 0, scenesUpdated: 0, scenesUnchanged: 4, scenesExtra: [] });
    expect((await liveScenes(db, first.id)).map(({ title }) => title)).toEqual(["Mine", "Scene 1", "Scene 2", "Scene 3"]);
  });

  it("finds a scene moved to another episode and leaves it there", async () => {
    await run(db, twoEpisodes());
    const { first, second } = await season(db);
    const [one] = await liveScenes(db, first.id);
    await moveScene(db, { sceneId: one.id, targetEpisodeId: second.id, version: first.scenesVersion });

    const changed = script([
      parsedEpisode(1, [parsedScene(1, "One changed"), parsedScene(2, "Two"), parsedScene(3, "Three")]),
      parsedEpisode(2, [parsedScene(1, "Four")]),
    ]);
    const result = await run(db, changed);

    expect(result).toMatchObject({ scenesInserted: 0, scenesUpdated: 1 });
    expect((await liveScenes(db, second.id)).map(firstText)).toEqual(["Four", "One changed"]);
    expect(await liveScenes(db, first.id)).toHaveLength(2);
  });

  it("puts a scene new in the document after the site's scenes", async () => {
    await run(db, twoEpisodes());
    const { first } = await season(db);
    const [one, two, three] = await liveScenes(db, first.id);
    await mustReorder({ episodeId: first.id, version: first.scenesVersion, ids: [three.id, two.id, one.id] });

    const longer = script([
      parsedEpisode(1, [parsedScene(1, "One"), parsedScene(2, "Two"), parsedScene(3, "Three"), parsedScene(4, "New")]),
      parsedEpisode(2, [parsedScene(1, "Four")]),
    ]);
    expect(await run(db, longer)).toMatchObject({ scenesInserted: 1 });
    expect((await liveScenes(db, first.id)).map(firstText)).toEqual(["Three", "Two", "One", "New"]);
  });

  it("still protects an edited scene after it was reordered", async () => {
    await run(db, twoEpisodes());
    const { first } = await season(db);
    const [one, two, three] = await liveScenes(db, first.id);
    await saveScene(db, { sceneId: one.id, userId, version: 1, title: "Scene 1", timecode: null, location: null, beats: [say("REVOC", "Edited")] });
    await mustReorder({ episodeId: first.id, version: first.scenesVersion, ids: [three.id, two.id, one.id] });

    const result = await run(db, twoEpisodes());

    expect(result.scenesProtected).toEqual(["e1:s1 (v2)"]);
    const [row] = await db.select().from(scenes).where(eq(scenes.id, one.id));
    expect(firstText(row)).toBe("Edited");
  });

  it("does not treat a reorder as an edit, so unedited scenes still update", async () => {
    await run(db, twoEpisodes());
    const { first } = await season(db);
    const [one, two, three] = await liveScenes(db, first.id);
    await mustReorder({ episodeId: first.id, version: first.scenesVersion, ids: [three.id, two.id, one.id] });

    const changed = script([parsedEpisode(1, [parsedScene(1, "One changed"), parsedScene(2, "Two"), parsedScene(3, "Three")])]);
    expect(await run(db, changed)).toMatchObject({ scenesUpdated: 1, scenesProtected: [] });
  });

  it("keeps a site reorder of episodes", async () => {
    await run(db, twoEpisodes());
    const { id, first, second, version } = await season(db);
    await reorderEpisodes(db, { seasonId: id, version, ids: [second.id, first.id] });

    expect(await run(db, twoEpisodes())).toMatchObject({ episodesCreated: 0, episodesUpdated: 0, scenesUnchanged: 4 });

    const rows = await db.select().from(episodes).where(eq(episodes.id, first.id));
    expect(rows[0].number).toBe(2);
  });

  it("leaves a deleted scene deleted, and does not report it missing", async () => {
    await run(db, twoEpisodes());
    const { first } = await season(db);
    const [one] = await liveScenes(db, first.id);
    await deleteScene(db, { sceneId: one.id, version: 1, userId });

    const result = await run(db, twoEpisodes(), true);

    expect(result).toMatchObject({ scenesDeleted: ["e1:s1"], scenesInserted: 0, scenesExtra: [] });
    const [row] = await db.select().from(scenes).where(eq(scenes.id, one.id));
    expect(row.deletedAt).not.toBeNull();
  });

  it("leaves a deleted episode deleted, with no links back, and a restore still works", async () => {
    await run(db, twoEpisodes());
    const { first } = await season(db);
    await deleteEpisode(db, { episodeId: first.id, version: 1, userId });

    const result = await run(db, twoEpisodes());

    expect(result).toMatchObject({ episodesDeleted: ["Episode 1"], episodesCreated: 0, scenesInserted: 0 });
    expect(await db.select().from(sceneCharacters)).toHaveLength(1);

    await restoreEpisode(db, { episodeId: first.id, version: 1 });
    expect(await db.select().from(sceneCharacters)).toHaveLength(4);
  });

  it("gives a new document episode the next number when the site has taken its own", async () => {
    await run(db, twoEpisodes());
    const { id, version } = await season(db);
    await createEpisode(db, { seasonId: id, version, number: 3, title: "Written on the site" });

    const longer = script([...twoEpisodes().episodes, parsedEpisode(3, [parsedScene(1, "Five")], "From the document")]);
    const result = await run(db, longer);

    expect(result.episodesRenumbered).toEqual(["Document episode 3 is now Episode 4"]);
    const rows = await db.select().from(episodes).where(and(eq(episodes.seasonId, id), eq(episodes.number, 3)));
    expect(rows[0].title).toBe("Written on the site");
  });

  it("protects an episode renamed on the site unless forced", async () => {
    await run(db, twoEpisodes());
    const { first } = await season(db);
    await updateEpisode(db, { episodeId: first.id, version: 1, patch: { title: "Renamed on the site" } });

    const parsed = twoEpisodes();
    expect(await run(db, parsed)).toMatchObject({ episodesProtected: ["Episode 1"], episodesUpdated: 0 });

    expect(await run(db, parsed, true)).toMatchObject({ episodesProtected: [], episodesUpdated: 1 });
    const [row] = await db.select().from(episodes).where(eq(episodes.id, first.id));
    expect(row).toMatchObject({ title: "Episode 1", version: 3 });
  });

  it("leaves status and summary alone", async () => {
    await run(db, twoEpisodes());
    const { first } = await season(db);
    await updateEpisode(db, { episodeId: first.id, version: 1, patch: { status: "done", summary: "Mine" } });

    await run(db, twoEpisodes());

    const [row] = await db.select().from(episodes).where(eq(episodes.id, first.id));
    expect(row).toMatchObject({ status: "done", summary: "Mine" });
  });
});

describe("aliases", () => {
  const twoSpeakers = () =>
    script([parsedEpisode(1, [parsedScene(1, "Hi", "REVOC"), parsedScene(2, "Hello", "CAPTAIN")])]);

  const cast = async () => (await db.select({ name: characters.name }).from(characters)).map(({ name }) => name).sort();

  it("does not bring back a merged card", async () => {
    await run(db, twoSpeakers());
    const rows = await db.select().from(characters);
    const source = rows.find(({ name }) => name === "CAPTAIN")!;
    const target = rows.find(({ name }) => name === "REVOC")!;
    await mergeCharacters(db, { sourceId: source.id, targetId: target.id, version: 1, userId });

    const result = await run(db, twoSpeakers());

    expect(result).toMatchObject({ charactersCreated: 0, charactersMatchedByAlias: ["CAPTAIN"] });
    expect(await cast()).toEqual(["REVOC"]);
  });

  it("counts lines under an alias on the merged card", async () => {
    await run(db, twoSpeakers());
    const rows = await db.select().from(characters);
    const source = rows.find(({ name }) => name === "CAPTAIN")!;
    const target = rows.find(({ name }) => name === "REVOC")!;
    await mergeCharacters(db, { sourceId: source.id, targetId: target.id, version: 1, userId });

    await run(db, twoSpeakers());

    const links = await db.select().from(sceneCharacters).where(eq(sceneCharacters.characterId, target.id));
    expect(links).toHaveLength(2);
  });

  it("adds an alias's lines to the name's in one scene", async () => {
    const mixed = script([
      parsedEpisode(1, [{ ...parsedScene(1, "Hi", "REVOC"), beats: [say("REVOC", "Hi"), say("OLD NAME", "Hello")] }]),
    ]);
    await run(db, script([parsedEpisode(1, [parsedScene(1, "Hi", "REVOC")])]));
    await db.update(characters).set({ aliases: ["OLD NAME"] });

    await run(db, mixed);

    const [link] = await db.select().from(sceneCharacters);
    expect(link.lineCount).toBe(2);
    expect(await cast()).toEqual(["REVOC"]);
  });

  it("does not fill a card's full name from a name that is only its alias", async () => {
    await run(db, script([parsedEpisode(1, [parsedScene(1, "Hi", "REVOC")])]));
    await db.update(characters).set({ name: "BOSS", aliases: ["SARAH"], fullName: null });

    await run(db, script([parsedEpisode(1, [parsedScene(1, "Hi", "SARAH")])]));

    const [card] = await db.select().from(characters);
    expect(card).toMatchObject({ name: "BOSS", fullName: null });
  });
});
