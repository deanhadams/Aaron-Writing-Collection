import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { characters, episodes, sceneRevisions, scenes, seasons, series, users, type Beat } from "@/lib/db/schema";
import { seedCharacters } from "@/lib/import/characters";
import type { ParsedScript } from "@/lib/import/parse-script";
import { writeImport } from "@/lib/import/write-import";
import { createEntry } from "@/lib/lore/write";
import { saveScene } from "@/lib/scenes/save-scene";
import { createTestDb } from "@/lib/scenes/test-db";
import { deleteEpisode } from "@/lib/structure/episode";
import { deleteScene, duplicateScene } from "@/lib/structure/scene";
import { episodeJump, parseQuery } from "./query";
import { runSearch } from "./run";
import { bestBeat, highlight } from "./snippet";

const said = (character: string, text: string, parenthetical?: string): Beat => ({
  id: crypto.randomUUID(),
  type: "dialogue",
  character,
  text,
  ...(parenthetical && { parenthetical }),
});
const seen = (text: string): Beat => ({ id: crypto.randomUUID(), type: "visual", text });

describe("parseQuery", () => {
  it("reads words, phrases, exclusions and filters", () => {
    expect(parseQuery(`ash "the big five" -slayer speaker:Revoc kind:outro ep:3-5`)).toEqual({
      terms: [["ash"]],
      phrases: [["the", "big", "five"]],
      excludes: [["slayer"]],
      speakers: ["revoc"],
      kinds: ["outro"],
      episodes: { from: 3, to: 5 },
    });
  });

  it("drops apostrophes, straight or curly", () => {
    expect(parseQuery("Bear'dion").terms).toEqual([["beardion"]]);
    expect(parseQuery("Bear’dion").terms).toEqual([["beardion"]]);
  });

  it("handles a quoted speaker and an unclosed quote", () => {
    expect(parseQuery(`speaker:"Bear'dion Slagdon"`).speakers).toEqual(["beardion slagdon"]);
    expect(parseQuery(`"ash force`).phrases).toEqual([["ash", "force"]]);
  });

  it("treats an unknown prefix as text", () => {
    expect(parseQuery("slayers: part").terms).toEqual([["slayers"], ["part"]]);
  });

  it("keeps tsquery syntax out of a search", () => {
    const parsed = parseQuery(`'; DROP TABLE scenes; -- & | ! :* <->`);
    expect(parsed.terms.flat().join(" ")).toMatch(/^[a-z ]+$/);
  });
});

describe("episodeJump", () => {
  it("reads the ways of asking", () => {
    expect(episodeJump("go to episode 12")).toBe(12);
    expect(episodeJump("Episode 3")).toBe(3);
    expect(episodeJump("ep 7")).toBe(7);
  });

  it("ignores everything else", () => {
    expect(episodeJump("episode twelve")).toBeNull();
    expect(episodeJump("the 12th episode")).toBeNull();
  });
});

describe("highlight", () => {
  const marked = (text: string, query: string) =>
    highlight(text, parseQuery(query)).filter(({ isMatch }) => isMatch).map(({ text: part }) => part);

  it("marks whole words and prefixes, keeping the text as written", () => {
    expect(marked("Desruc looks up.", "desr")).toEqual(["Desruc"]);
  });

  it("marks a typo's real word", () => {
    expect(marked("Revoc stands there.", "Revok")).toEqual(["Revoc"]);
  });

  it("marks a phrase only when the words are together", () => {
    expect(marked("The ash force is here.", '"ash force"')).toEqual(["ash", "force"]);
    expect(marked("Ash and the force.", '"ash force"')).toEqual([]);
  });

  it("matches across an apostrophe", () => {
    expect(marked("Bear’dion roars.", "Beardion")).toEqual(["Bear’dion"]);
  });

  it("gives back the text unchanged when nothing matches", () => {
    expect(highlight("Nothing here.", parseQuery("zebra"))).toEqual([{ text: "Nothing here.", isMatch: false }]);
  });
});

describe("bestBeat", () => {
  it("picks the line that matches, with its speaker", () => {
    const line = said("DESRUC", "Oh, just a book about extinct animals.", "Looks up");
    const snippet = bestBeat([seen("A classroom."), line], parseQuery("extinct"));

    expect(snippet).toMatchObject({ beatId: line.id, speaker: "DESRUC", parenthetical: "Looks up", type: "dialogue" });
  });

  it("prefers the speaker asked for", () => {
    const theirs = said("DANIEL", "The book.");
    const mine = said("REVOC", "The book.");
    expect(bestBeat([theirs, mine], parseQuery("book speaker:Revoc"))?.beatId).toBe(mine.id);
  });

  it("brings a late match to the front of a line under the limit", () => {
    const beat = seen(`${"word ".repeat(20)}extinct end`);
    const { segments } = bestBeat([beat], parseQuery("extinct"))!;
    const before = segments.slice(0, segments.findIndex(({ isMatch }) => isMatch)).map(({ text }) => text).join("");

    expect(before.length).toBeLessThan(35);
  });

  it("shortens a long line around the match", () => {
    const beat = said("REVOC", `${"word ".repeat(100)}extinct ${"word ".repeat(100)}`);
    const { segments } = bestBeat([beat], parseQuery("extinct"))!;

    expect(segments.find(({ isMatch }) => isMatch)?.text).toBe("extinct");
    expect(segments[0].text).toBe("…");
    expect(segments.at(-1)?.text).toBe("…");
  });
});

describe("search", () => {
  let db: Awaited<ReturnType<typeof createTestDb>>;
  let userId: string;
  let seasonId: string;
  let firstId: string;
  let secondId: string;

  beforeEach(async () => {
    db = await createTestDb();
    [{ id: userId }] = await db.insert(users).values({ email: "dean@example.com", name: "Dean", passwordHash: "x" }).returning();
    const [{ id: seriesId }] = await db.insert(series).values({ title: "Devil Bunny" }).returning();
    [{ id: seasonId }] = await db.insert(seasons).values({ seriesId, number: 1 }).returning();
    [{ id: firstId }, { id: secondId }] = await db
      .insert(episodes)
      .values([
        { seasonId, number: 1, title: "NO HELL", summary: "Where it all begins" },
        { seasonId, number: 2, title: "THE ASH FORCE" },
      ])
      .returning();
    await db.insert(scenes).values([
      {
        episodeId: firstId,
        position: 1,
        title: "Classroom Conflict",
        location: "CLASSROOM - DAY",
        timecode: "2:00 - 6:00",
        beats: [seen("The scene opens on a slight boy."), said("DESRUC", "Oh, just a book about extinct animals.", "Looks up")],
      },
      {
        episodeId: firstId,
        position: 2,
        kind: "post_credit",
        title: "The Watcher",
        beats: [said("REVOC", "You can call me a hero."), said("BEAR’DION", "Not a chance.")],
      },
      {
        episodeId: secondId,
        position: 1,
        title: "The Observation Room",
        beats: [said("DESRUC", "The ash force will come."), seen("Rain falls on the ash.")],
      },
    ]);
    await db.insert(characters).values([
      { seriesId, name: "DESRUC", fullName: "Desruc Nemo", slug: "desruc", backstory: "Raised by Lida." },
      { seriesId, name: "REVOC", slug: "revoc", aliases: ["REVOC ERIFLLEH"], gift: "Mentioned Desruc once" },
    ]);
  });

  const search = (input: string, options = {}) => runSearch(db, input, { limit: 20, ...options });
  const sceneTitles = async (input: string, options = {}) => (await search(input, options)).scenes.results.map(({ title }) => title);

  describe("search_text", () => {
    const stored = async (title: string) => {
      const [row] = await db.select({ text: scenes.searchText }).from(scenes).where(eq(scenes.title, title));
      return row.text;
    };

    it("holds the title, location, speakers, asides and every line", async () => {
      const text = await stored("Classroom Conflict");
      for (const word of ["classroom conflict", "classroom - day", "desruc", "looks up", "extinct animals", "slight boy"]) {
        expect(text).toContain(word);
      }
    });

    it("was filled in without touching versions, timestamps or history", async () => {
      const rows = await db.select({ version: scenes.version }).from(scenes);
      expect(rows.every(({ version }) => version === 1)).toBe(true);
      expect(await db.select().from(sceneRevisions)).toEqual([]);
    });

    it("follows a save", async () => {
      const [scene] = await db.select().from(scenes).where(eq(scenes.title, "The Watcher"));
      await saveScene(db, { sceneId: scene.id, userId, version: 1, title: "Renamed", timecode: null, location: "ROOFTOP", beats: [seen("Thunderbolt.")] });

      const text = await stored("Renamed");
      expect(text).toContain("thunderbolt");
      expect(text).toContain("rooftop");
      expect(text).not.toContain("hero");
      expect(await sceneTitles("thunderbolt")).toEqual(["Renamed"]);
    });

    it("follows a duplicate", async () => {
      const [scene] = await db.select().from(scenes).where(eq(scenes.title, "The Watcher"));
      const [{ scenesVersion }] = await db.select({ scenesVersion: episodes.scenesVersion }).from(episodes).where(eq(episodes.id, firstId));
      await duplicateScene(db, { sceneId: scene.id, version: scenesVersion, userId });

      expect((await sceneTitles("hero")).sort()).toEqual(["The Watcher", "The Watcher (copy)"]);
    });

    it("is written by the importer", async () => {
      const script: ParsedScript = {
        seasonNumber: 3,
        episodes: [
          {
            number: 1,
            title: "IMPORTED",
            openingTheme: null,
            outroTheme: null,
            scenes: [{ position: 1, kind: "scene", title: "From Word", timecode: null, location: "HARBOUR", beats: [said("REVOC", "Quicksilver.")] }],
          },
        ],
        warnings: [],
        ignoredLines: [],
        repeatedSeasonHeadings: 0,
        droppedEndLines: 0,
      };
      await db.transaction((tx) => writeImport(tx, script, seedCharacters(script), { force: false, removeSample: false, seriesTitle: "Devil Bunny" }));

      expect(await sceneTitles("quicksilver")).toEqual(["From Word"]);
      expect(await sceneTitles("harbour")).toEqual(["From Word"]);
    });
  });

  describe("ranking", () => {
    it("finds a character's lines by name", async () => {
      const { scenes: found, characters: cards } = await search("Desruc");

      expect(found.results.map(({ title }) => title).sort()).toEqual(["Classroom Conflict", "The Observation Room"]);
      expect(found.results.every(({ snippet }) => snippet?.speaker === "DESRUC")).toBe(true);
      expect(cards.results[0].name).toBe("DESRUC");
    });

    it("puts the card with the name above one that only mentions it", async () => {
      const { characters: cards } = await search("Desruc");
      expect(cards.results.map(({ name }) => name)).toEqual(["DESRUC", "REVOC"]);
    });

    it("still finds results through a typo", async () => {
      expect(await sceneTitles("Revok")).toEqual(["The Watcher"]);
      expect((await search("Revok")).characters.results[0].name).toBe("REVOC");
      expect(await sceneTitles("Desruk")).toContain("Classroom Conflict");
    });

    it("matches a prefix as you type", async () => {
      expect(await sceneTitles("extin")).toEqual(["Classroom Conflict"]);
    });

    it("finds a name with or without its apostrophe", async () => {
      expect(await sceneTitles("Beardion")).toEqual(["The Watcher"]);
      expect(await sceneTitles("Bear'dion")).toEqual(["The Watcher"]);
    });

    it("needs every word", async () => {
      expect(await sceneTitles("rain ash")).toEqual(["The Observation Room"]);
      expect(await sceneTitles("rain extinct")).toEqual([]);
    });

    it("does not find made-up words", async () => {
      expect(await sceneTitles("zxqwv")).toEqual([]);
    });

    it("does not blur short words into others", async () => {
      expect(await sceneTitles("ask")).toEqual([]);
    });
  });

  describe("phrases and exclusions", () => {
    it("matches a quoted phrase exactly, in order", async () => {
      expect(await sceneTitles('"ash force"')).toEqual(["The Observation Room"]);
      expect(await sceneTitles('"force ash"')).toEqual([]);
    });

    it("leaves out an excluded word", async () => {
      expect(await sceneTitles("desruc -extinct")).toEqual(["The Observation Room"]);
    });

    it("leaves out an excluded phrase", async () => {
      expect(await sceneTitles('desruc -"ash force"')).toEqual(["Classroom Conflict"]);
    });
  });

  describe("filters", () => {
    it("filters by speaker, including through an alias", async () => {
      expect(await sceneTitles("speaker:Desruc")).toEqual(["Classroom Conflict", "The Observation Room"]);
      expect(await sceneTitles("hero speaker:Desruc")).toEqual([]);
      expect(await sceneTitles("hero speaker:Revoc")).toEqual(["The Watcher"]);
    });

    it("needs the speaker to say the words, not just be in the scene", async () => {
      expect(await sceneTitles("book speaker:Desruc")).toEqual(["Classroom Conflict"]);
      expect(await sceneTitles("chance speaker:Revoc")).toEqual([]);
      expect(await sceneTitles("chance speaker:Bear")).toEqual(["The Watcher"]);
    });

    it("counts a line written under a card's other name", async () => {
      await db.update(characters).set({ aliases: ["THE HERO"] }).where(eq(characters.name, "REVOC"));
      const [scene] = await db.select().from(scenes).where(eq(scenes.title, "The Watcher"));
      await db.update(scenes).set({ beats: [said("THE HERO", "Old name line.")] }).where(eq(scenes.id, scene.id));

      expect(await sceneTitles("line speaker:Revoc")).toEqual(["The Watcher"]);
    });

    it("filters by scene kind", async () => {
      expect(await sceneTitles("kind:post-credit")).toEqual(["The Watcher"]);
    });

    it("filters by episode range", async () => {
      expect(await sceneTitles("desruc ep:2")).toEqual(["The Observation Room"]);
      expect(await sceneTitles("desruc episode:1-2")).toHaveLength(2);
    });

    it("limits to one type", async () => {
      const { scenes: found, characters: cards } = await search("Desruc", { type: "characters" });
      expect(found.results).toEqual([]);
      expect(cards.results).toHaveLength(2);
    });

    it("sorts in episode order on request", async () => {
      expect(await sceneTitles("desruc", { sort: "episode" })).toEqual(["Classroom Conflict", "The Observation Room"]);
    });

    it("pages through results and counts them all", async () => {
      const first = await search("desruc", { limit: 1, sort: "episode" });
      const second = await search("desruc", { limit: 1, offset: 1, sort: "episode" });

      expect(first.scenes.total).toBe(2);
      expect(first.scenes.results[0].title).toBe("Classroom Conflict");
      expect(second.scenes.results[0].title).toBe("The Observation Room");
    });
  });

  describe("other types", () => {
    it("searches episode titles and summaries", async () => {
      expect((await search("begins")).episodes.results.map(({ number }) => number)).toEqual([1]);
      expect((await search("ash")).episodes.results.map(({ number }) => number)).toEqual([2]);
    });

    it("searches every character field, and aliases", async () => {
      expect((await search("Lida")).characters.results.map(({ name }) => name)).toEqual(["DESRUC"]);
      expect((await search("Eriflleh")).characters.results.map(({ name }) => name)).toEqual(["REVOC"]);
    });

    it("searches lore", async () => {
      await createEntry(db, { title: "The Colosseum", category: "Places", userId, body: "A vast arena." });
      expect((await search("arena")).lore.results.map(({ title }) => title)).toEqual(["The Colosseum"]);
    });

    it("finds the episode to jump to", async () => {
      expect((await search("go to episode 2")).jump).toMatchObject({ id: secondId, number: 2 });
    });
  });

  describe("deleted work", () => {
    it("hides a deleted scene", async () => {
      const [scene] = await db.select().from(scenes).where(eq(scenes.title, "The Watcher"));
      await deleteScene(db, { sceneId: scene.id, version: 1, userId });
      expect(await sceneTitles("hero")).toEqual([]);
    });

    it("hides a deleted episode and its scenes", async () => {
      await deleteEpisode(db, { episodeId: secondId, version: 1, userId });
      expect(await sceneTitles("rain")).toEqual([]);
      expect((await search("ash force")).episodes.results).toEqual([]);
    });
  });

  it("treats a hostile search as plain words", async () => {
    await search(`'; DROP TABLE scenes; --`);
    await search(`":* <-> & | ! \\`);
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(scenes);
    expect(count).toBe(3);
  });

  it("returns nothing for an empty search", async () => {
    expect((await search("   ")).scenes).toEqual({ total: 0, results: [] });
    expect((await search(`"" - :`)).scenes.total).toBe(0);
  });
});
