import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { sceneCharacters, sceneRevisions, scenes, type Beat } from "@/lib/db/schema";
import { heartbeat, leaveScene } from "./presence";
import { listRevisions, restoreRevision, saveScene } from "./save-scene";
import { createTestDb, seedScene } from "./test-db";

const line = (id: string, character: string, text: string): Beat => ({ id, type: "dialogue", character, text });

const header = { title: "Start", timecode: null, location: null };

describe("scene saves", () => {
  let db: Awaited<ReturnType<typeof createTestDb>>;
  let seed: Awaited<ReturnType<typeof seedScene>>;
  let sceneId: string;

  const row = async () => (await db.select().from(scenes).where(eq(scenes.id, sceneId)))[0];
  const revisions = () => db.select().from(sceneRevisions).where(eq(sceneRevisions.sceneId, sceneId));
  const links = async () => {
    const rows = await db.select().from(sceneCharacters).where(eq(sceneCharacters.sceneId, sceneId));
    const names = new Map(seed.cast.map(({ id, name }) => [id, name]));
    return Object.fromEntries(rows.map(({ characterId, lineCount }) => [names.get(characterId), lineCount]));
  };
  const save = (version: number, beats: Beat[], userId = seed.dean.id) =>
    saveScene(db, { sceneId, userId, version, beats, ...header });

  beforeEach(async () => {
    db = await createTestDb();
    seed = await seedScene(db, [{ id: "orig", type: "note", text: "Original" }]);
    sceneId = seed.scene.id;
  }, 30_000);

  it("saves when the version matches and moves it on", async () => {
    const result = await save(1, [line("a", "REVOC", "Hello")]);

    expect(result).toEqual({ status: "saved", version: 2 });
    const scene = await row();
    expect(scene.version).toBe(2);
    expect(scene.beats[0].text).toBe("Hello");
    expect(scene.updatedBy).toBe(seed.dean.id);
  });

  it("refuses a stale version and leaves the scene alone", async () => {
    await save(1, [line("a", "REVOC", "Kept")], seed.kim.id);

    const result = await save(1, [line("b", "REVOC", "Lost race")]);

    expect(result).toEqual({ status: "conflict", version: 2 });
    expect((await row()).beats[0].text).toBe("Kept");
    expect(await revisions()).toHaveLength(1);
  });

  it("treats a retry of a save that already landed as saved", async () => {
    const beats = [line("a", "REVOC", "Hello")];
    await save(1, beats);

    expect(await save(1, beats)).toEqual({ status: "saved", version: 2 });
    expect(await revisions()).toHaveLength(1);
  });

  it("does not excuse someone else's identical text as a retry", async () => {
    const beats = [line("a", "REVOC", "Hello")];
    await save(1, beats, seed.kim.id);

    expect((await save(1, beats)).status).toBe("conflict");
  });

  it("lets only one of two simultaneous saves through", async () => {
    const results = await Promise.all([
      save(1, [line("a", "REVOC", "One")]),
      save(1, [line("b", "DESRUC", "Two")], seed.kim.id),
    ]);

    expect(results.map(({ status }) => status).sort()).toEqual(["conflict", "saved"]);
    expect(await revisions()).toHaveLength(1);
  });

  it("writes the previous beats to a revision, credited to who saved them", async () => {
    await save(1, [line("a", "REVOC", "Kim wrote this")], seed.kim.id);
    await save(2, [line("a", "REVOC", "Dean wrote this")]);

    const [imported, byKim] = (await revisions()).sort((a, b) => +a.savedAt - +b.savedAt);
    expect(imported.beats[0].text).toBe("Original");
    expect(imported.savedBy).toBeNull();
    expect(byKim.beats[0].text).toBe("Kim wrote this");
    expect(byKim.savedBy).toBe(seed.kim.id);
  });

  it("rebuilds scene_characters with shared speakers and skips names with no card", async () => {
    await save(1, [
      line("a", "REVOC & DESRUC", "Together"),
      line("b", "REVOC", "Alone"),
      { id: "c", type: "vo", character: "INTERCOM", text: "Attention" },
      line("d", "NEWCOMER", "Hi"),
    ]);
    expect(await links()).toEqual({ REVOC: 2, DESRUC: 1 });

    await save(2, [line("a", "DESRUC", "Just me")]);
    expect(await links()).toEqual({ DESRUC: 1 });
  });

  it("reports a missing scene", async () => {
    const result = await saveScene(db, {
      sceneId: "00000000-0000-4000-8000-000000000000",
      userId: seed.dean.id,
      version: 1,
      beats: [],
      ...header,
    });
    expect(result).toEqual({ status: "not_found" });
  });

  describe("restore", () => {
    it("saves the old beats as a new version with the current ones in history", async () => {
      await save(1, [line("a", "REVOC", "Second")], seed.kim.id);
      const [original] = await listRevisions(db, sceneId);

      const result = await restoreRevision(db, {
        sceneId,
        revisionId: original.id,
        userId: seed.dean.id,
        version: 2,
      });

      expect(result).toMatchObject({ status: "saved", version: 3 });
      const scene = await row();
      expect(scene.beats[0].text).toBe("Original");
      expect(scene.updatedBy).toBe(seed.dean.id);

      const history = await listRevisions(db, sceneId);
      expect(history.map(({ preview }) => preview[0].text)).toContain("Second");
      expect(history.find(({ preview }) => preview[0].text === "Second")?.savedBy).toBe("Kim");
    });

    it("rebuilds scene_characters from the restored beats", async () => {
      await save(1, [line("a", "REVOC", "One")]);
      await save(2, [line("a", "DESRUC", "Two")]);
      const history = await listRevisions(db, sceneId);
      const withRevoc = history.find(({ preview }) => preview[0].character === "REVOC")!;

      await restoreRevision(db, { sceneId, revisionId: withRevoc.id, userId: seed.dean.id, version: 3 });

      expect(await links()).toEqual({ REVOC: 1 });
    });

    it("refuses a stale version", async () => {
      await save(1, [line("a", "REVOC", "Second")]);
      const [original] = await listRevisions(db, sceneId);

      const result = await restoreRevision(db, { sceneId, revisionId: original.id, userId: seed.dean.id, version: 1 });

      expect(result).toEqual({ status: "conflict", version: 2 });
    });

    it("refuses a revision from another scene", async () => {
      const result = await restoreRevision(db, {
        sceneId,
        revisionId: "00000000-0000-4000-8000-000000000000",
        userId: seed.dean.id,
        version: 1,
      });
      expect(result).toEqual({ status: "not_found" });
    });
  });

  describe("presence", () => {
    it("shows other people, never yourself, and forgets them when they go quiet", async () => {
      const now = new Date("2026-01-01T12:00:00Z");
      const later = (ms: number) => new Date(now.getTime() + ms);

      await heartbeat(db, { sceneId, userId: seed.kim.id, now });
      expect(await heartbeat(db, { sceneId, userId: seed.dean.id, now })).toEqual(["Kim"]);
      expect(await heartbeat(db, { sceneId, userId: seed.kim.id, now: later(15_000) })).toEqual(["Dean"]);
      expect(await heartbeat(db, { sceneId, userId: seed.dean.id, now: later(120_000) })).toEqual([]);
    });

    it("clears someone on leaving", async () => {
      await heartbeat(db, { sceneId, userId: seed.kim.id });
      await leaveScene(db, { sceneId, userId: seed.kim.id });
      expect(await heartbeat(db, { sceneId, userId: seed.dean.id })).toEqual([]);
    });
  });
});
