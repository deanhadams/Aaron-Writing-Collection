import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import {
  characterImages,
  characterRelationships,
  characters,
  sceneCharacters,
  scenes,
  type Beat,
} from "@/lib/db/schema";
import { saveScene } from "@/lib/scenes/save-scene";
import { createTestDb, seedScene } from "@/lib/scenes/test-db";
import { loadCharacter, loadGallery } from "./read";
import type { CharacterFields } from "./validate";
import {
  addImage,
  createCharacter,
  deleteCharacter,
  mergeCharacters,
  reorderImages,
  saveCharacter,
  setPortrait,
} from "./write";

const line = (id: string, character: string, text = "Hi"): Beat => ({ id, type: "dialogue", character, text });

const BEATS = [
  line("a", "REVOC"),
  line("b", "REVOC"),
  line("c", "DESRUC"),
  line("d", "REVOC & DESRUC"),
  line("e", "NEWCOMER"),
  line("f", "NC"),
  { id: "g", type: "vo", character: "INTERCOM", text: "Attention" },
] as Beat[];

const fieldsFor = (row: typeof characters.$inferSelect, over: Partial<CharacterFields> = {}): CharacterFields => ({
  name: row.name,
  fullName: row.fullName,
  role: null,
  gift: null,
  appearance: null,
  personality: null,
  backstory: null,
  powers: null,
  notes: null,
  color: null,
  aliases: row.aliases,
  relationships: [],
  ...over,
});

describe("characters", () => {
  let db: Awaited<ReturnType<typeof createTestDb>>;
  let seed: Awaited<ReturnType<typeof seedScene>>;
  let revoc: typeof characters.$inferSelect;
  let desruc: typeof characters.$inferSelect;
  let userId: string;

  const get = async (id: string) => (await db.select().from(characters).where(eq(characters.id, id)))[0];
  const linesOf = async (id: string) =>
    (await db.select().from(sceneCharacters).where(eq(sceneCharacters.characterId, id)))
      .reduce((total, { lineCount }) => total + lineCount, 0);
  const rebuild = async () =>
    saveScene(db, { sceneId: seed.scene.id, userId, version: 1, beats: BEATS, title: "Start", timecode: null, location: null });

  beforeEach(async () => {
    db = await createTestDb();
    seed = await seedScene(db, BEATS);
    userId = seed.dean.id;
    [revoc, desruc] = seed.cast;
    await rebuild();
  }, 30_000);

  describe("gallery stats", () => {
    it("reads lines and episodes from scene_characters", async () => {
      const { cards } = await loadGallery(db);
      const stats = (name: string) => cards.find((card) => card.name === name)?.stats;

      expect(stats("REVOC")).toMatchObject({ lines: 3, scenes: 1, episodes: 1 });
      expect(stats("DESRUC")).toMatchObject({ lines: 2, episodes: 1 });
    });

    it("lists speakers with no card, but not voice labels", async () => {
      const { noCard } = await loadGallery(db);
      expect(noCard).toEqual([
        { name: "NC", lines: 1 },
        { name: "NEWCOMER", lines: 1 },
      ]);
    });
  });

  describe("character page", () => {
    it("groups appearances and finds scene partners", async () => {
      const page = await loadCharacter(db, "revoc");

      expect(page?.totalLines).toBe(3);
      expect(page?.appearances[0]).toMatchObject({ number: 1, lines: 3 });
      expect(page?.first?.sceneId).toBe(seed.scene.id);
      expect(page?.partners).toMatchObject([{ name: "DESRUC", scenes: 1 }]);
      expect(page?.chart).toMatchObject([{ episodeNumber: 1, lines: 3 }]);
    });

    it("returns nothing for an unknown slug", async () => {
      expect(await loadCharacter(db, "nobody")).toBeNull();
    });
  });

  describe("create", () => {
    it("links the speaker's existing lines to a new card", async () => {
      const result = await createCharacter(db, { name: "newcomer", fullName: "New Comer", userId });

      expect(result).toMatchObject({ status: "created", slug: "new-comer", linked: 1 });
      if (result.status !== "created") throw new Error("not created");
      expect(await linesOf(result.id)).toBe(1);
      expect((await loadGallery(db)).noCard).toEqual([{ name: "NC", lines: 1 }]);
    });

    it("refuses a name already in use, including as an alias", async () => {
      expect(await createCharacter(db, { name: "REVOC", fullName: null, userId })).toMatchObject({ status: "name_taken" });

      await saveCharacter(db, { ...fieldsFor(revoc, { aliases: ["REV"] }), id: revoc.id, version: 1, userId });
      expect(await createCharacter(db, { name: "rev", fullName: null, userId })).toMatchObject({ status: "name_taken" });
    });

    it("gives a second card with the same name a different slug", async () => {
      await createCharacter(db, { name: "OTHER", fullName: "Revoc", userId });
      const [row] = await db.select().from(characters).where(eq(characters.name, "OTHER"));
      expect(row.slug).toBe("revoc-2");
    });
  });

  describe("save with a version check", () => {
    it("saves, moves the version on and records who", async () => {
      const result = await saveCharacter(db, { ...fieldsFor(revoc, { backstory: "Born in ash." }), id: revoc.id, version: 1, userId });

      expect(result).toEqual({ status: "saved", version: 2 });
      expect(await get(revoc.id)).toMatchObject({ backstory: "Born in ash.", version: 2, updatedBy: userId });
    });

    it("refuses a stale version and changes nothing", async () => {
      await saveCharacter(db, { ...fieldsFor(revoc, { notes: "Kim's" }), id: revoc.id, version: 1, userId: seed.kim.id });

      const result = await saveCharacter(db, { ...fieldsFor(revoc, { notes: "Dean's" }), id: revoc.id, version: 1, userId });

      expect(result).toEqual({ status: "conflict", version: 2 });
      expect((await get(revoc.id)).notes).toBe("Kim's");
    });

    it("treats an empty version as 1", async () => {
      await db.update(characters).set({ version: null }).where(eq(characters.id, revoc.id));
      expect(await saveCharacter(db, { ...fieldsFor(revoc), id: revoc.id, version: 1, userId })).toEqual({ status: "saved", version: 2 });
    });

    it("keeps the old name as an alias on a rename, so scripts still match", async () => {
      await saveCharacter(db, { ...fieldsFor(revoc, { name: "REVOKER" }), id: revoc.id, version: 1, userId });

      expect((await get(revoc.id)).aliases).toEqual(["REVOC"]);
      expect(await linesOf(revoc.id)).toBe(3);
    });

    it("links lines for a new alias", async () => {
      await saveCharacter(db, { ...fieldsFor(revoc, { aliases: ["NC"] }), id: revoc.id, version: 1, userId });
      expect(await linesOf(revoc.id)).toBe(4);
    });

    it("refuses a name another card uses", async () => {
      const result = await saveCharacter(db, { ...fieldsFor(revoc, { name: "DESRUC" }), id: revoc.id, version: 1, userId });
      expect(result).toEqual({ status: "name_taken", name: "DESRUC" });
    });

    it("saves relationships and ignores a link to themselves", async () => {
      await saveCharacter(db, {
        ...fieldsFor(revoc, {
          relationships: [
            { relatedId: desruc.id, note: "Rival" },
            { relatedId: revoc.id, note: "Self" },
          ],
        }),
        id: revoc.id,
        version: 1,
        userId,
      });

      const page = await loadCharacter(db, "revoc");
      expect(page?.relationships).toMatchObject([{ name: "DESRUC", note: "Rival" }]);
    });
  });

  describe("merge", () => {
    it("moves appearances and keeps the old name as an alias", async () => {
      const result = await mergeCharacters(db, { sourceId: desruc.id, targetId: revoc.id, version: 1, userId });

      expect(result).toEqual({ status: "merged", slug: "revoc" });
      expect(await get(desruc.id)).toBeUndefined();
      expect((await get(revoc.id)).aliases).toEqual(["DESRUC"]);
      expect(await linesOf(revoc.id)).toBe(5);
    });

    it("keeps the source's aliases too", async () => {
      await saveCharacter(db, { ...fieldsFor(desruc, { aliases: ["DEZ"] }), id: desruc.id, version: 1, userId });
      await mergeCharacters(db, { sourceId: desruc.id, targetId: revoc.id, version: 2, userId });

      expect((await get(revoc.id)).aliases.sort()).toEqual(["DESRUC", "DEZ"]);
    });

    it("survives the next scene save, which matches by alias", async () => {
      await mergeCharacters(db, { sourceId: desruc.id, targetId: revoc.id, version: 1, userId });

      await saveScene(db, { sceneId: seed.scene.id, userId, version: 2, beats: BEATS, title: "Again", timecode: null, location: null });

      expect(await linesOf(revoc.id)).toBe(5);
    });

    it("leaves the script text as written", async () => {
      await mergeCharacters(db, { sourceId: desruc.id, targetId: revoc.id, version: 1, userId });
      const [scene] = await db.select().from(scenes).where(eq(scenes.id, seed.scene.id));
      expect(scene.beats[2].character).toBe("DESRUC");
    });

    it("moves images and relationships, and repoints links to the old card", async () => {
      await addImage(db, desruc.id, "characters/desruc/a.png", null);
      const [third] = await db.insert(characters).values({ seriesId: revoc.seriesId, name: "THIRD", slug: "third" }).returning();
      await db.insert(characterRelationships).values([
        { characterId: desruc.id, relatedId: third.id, note: "Friend" },
        { characterId: third.id, relatedId: desruc.id, note: "Friend back" },
        { characterId: revoc.id, relatedId: desruc.id, note: "Rival" },
      ]);

      await mergeCharacters(db, { sourceId: desruc.id, targetId: revoc.id, version: 1, userId });

      const images = await db.select().from(characterImages).where(eq(characterImages.characterId, revoc.id));
      expect(images).toHaveLength(1);
      const links = await db.select().from(characterRelationships);
      expect(links.map(({ characterId, relatedId }) => [characterId, relatedId])).toEqual(
        expect.arrayContaining([[revoc.id, third.id], [third.id, revoc.id]]),
      );
      expect(links.some(({ characterId, relatedId }) => characterId === relatedId)).toBe(false);
    });

    it("keeps the source's writing in the target's notes", async () => {
      await saveCharacter(db, { ...fieldsFor(desruc, { backstory: "Grew up alone." }), id: desruc.id, version: 1, userId });
      await saveCharacter(db, { ...fieldsFor(revoc, { notes: "Existing." }), id: revoc.id, version: 1, userId });

      await mergeCharacters(db, { sourceId: desruc.id, targetId: revoc.id, version: 2, userId });

      const { notes } = await get(revoc.id);
      expect(notes).toContain("Existing.");
      expect(notes).toContain("From DESRUC:");
      expect(notes).toContain("Backstory: Grew up alone.");
    });

    it("takes the source's portrait only if the target has none", async () => {
      await setPortrait(db, desruc.id, "characters/desruc.png", userId);
      await mergeCharacters(db, { sourceId: desruc.id, targetId: revoc.id, version: 1, userId });
      expect((await get(revoc.id)).portraitKey).toBe("characters/desruc.png");
    });

    it("refuses a stale version, and a merge into itself", async () => {
      expect(await mergeCharacters(db, { sourceId: desruc.id, targetId: revoc.id, version: 9, userId })).toEqual({ status: "conflict", version: 1 });
      expect(await mergeCharacters(db, { sourceId: revoc.id, targetId: revoc.id, version: 1, userId })).toEqual({ status: "same_character" });
      expect(await get(desruc.id)).toBeDefined();
    });
  });

  describe("delete", () => {
    it("refuses while they appear in scenes", async () => {
      expect(await deleteCharacter(db, revoc.id)).toMatchObject({ status: "has_appearances" });
      expect(await get(revoc.id)).toBeDefined();
    });

    it("deletes a character with no appearances", async () => {
      const created = await createCharacter(db, { name: "UNUSED", fullName: null, userId });
      if (created.status !== "created") throw new Error("not created");

      expect(await deleteCharacter(db, created.id)).toEqual({ status: "deleted" });
      expect(await get(created.id)).toBeUndefined();
    });
  });

  describe("images", () => {
    it("adds in order, and reorders", async () => {
      const one = await addImage(db, revoc.id, "characters/revoc/1.png", "One");
      const two = await addImage(db, revoc.id, "characters/revoc/2.png", null);
      expect([one.position, two.position]).toEqual([0, 1]);

      await reorderImages(db, revoc.id, [two.id, one.id]);

      const page = await loadCharacter(db, "revoc");
      expect(page?.images.map(({ caption }) => caption)).toEqual([null, "One"]);
    });

    it("does not touch another character's image through a wrong id", async () => {
      const image = await addImage(db, revoc.id, "characters/revoc/1.png", null);
      await reorderImages(db, desruc.id, [image.id]);
      expect((await loadCharacter(db, "revoc"))?.images).toHaveLength(1);
    });

    it("sets a portrait without moving the version, so an open editor stays valid", async () => {
      await setPortrait(db, revoc.id, "characters/revoc.png", userId);
      expect(await get(revoc.id)).toMatchObject({ portraitKey: "characters/revoc.png", version: 1 });
    });
  });
});
