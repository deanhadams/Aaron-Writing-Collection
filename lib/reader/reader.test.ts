import { beforeEach, describe, expect, it } from "vitest";
import { episodes, scenes, seasons, series, users, type Beat } from "@/lib/db/schema";
import { episodePageRule, oneLine, sceneHeading, sceneNumbers, spokenText } from "@/lib/script/format";
import { createTestDb } from "@/lib/scenes/test-db";
import { deleteScene } from "@/lib/structure/scene";
import { currentIndex, readerKey, scrollProgress, stepIndex } from "./navigation";
import { loadOutline, loadProgress, saveProgress } from "./read";
import { DEFAULT_SETTINGS, parseSettings, readerVariables } from "./settings";

const spoken = (fields: Partial<Beat>): Beat => ({ id: "1", type: "dialogue", text: "Hi", ...fields });

describe("sceneHeading", () => {
  it.each([
    [{ kind: "scene", title: "The Bully" }, 3, "Scene 3: The Bully"],
    [{ kind: "scene", title: null }, 3, "Scene 3"],
    [{ kind: "prologue", title: null }, null, "Prologue"],
    [{ kind: "prologue", title: "Before" }, null, "Prologue: Before"],
    [{ kind: "post_credit", title: "The Watcher" }, null, "End Scene (The Watcher)"],
    [{ kind: "post_credit", title: null }, null, "End Scene"],
  ] as const)("writes %j", (scene, number, expected) => {
    expect(sceneHeading(scene, number)).toBe(expected);
  });
});

describe("sceneNumbers", () => {
  it("counts regular scenes only", () => {
    const kinds = ["prologue", "scene", "outro", "scene", "post_credit"] as const;
    expect(sceneNumbers(kinds.map((kind) => ({ kind })))).toEqual([null, 1, null, 2, null]);
  });
});

describe("spokenText", () => {
  it("shows a name and parenthetical", () => {
    expect(spokenText(spoken({ character: "desruc", parenthetical: "Quietly" }))).toEqual({ speaker: "DESRUC", parenthetical: "Quietly", text: "Hi" });
  });

  it("marks a named voice over", () => {
    expect(spokenText(spoken({ type: "vo", character: "SARAH" })).speaker).toBe("SARAH (V.O.)");
  });

  it("shows a voice label on its own", () => {
    expect(spokenText(spoken({ type: "vo", character: "INTERCOM" })).speaker).toBe("INTERCOM");
  });

  it("folds a description into an unnamed voice", () => {
    expect(spokenText(spoken({ type: "vo", parenthetical: "Unrecognizable Voice" }))).toMatchObject({
      speaker: "V.O. (Unrecognizable Voice)",
      parenthetical: null,
    });
  });

  it("keeps capitals out of the tag, where they would read as a name", () => {
    expect(spokenText(spoken({ type: "vo", parenthetical: "STATIC" }))).toMatchObject({ speaker: "V.O.", parenthetical: "STATIC" });
  });
});

describe("episodePageRule", () => {
  it("names the page and puts the title in its top margin", () => {
    expect(episodePageRule({ number: 3, title: "The Ash Force" })).toBe(
      '@page episode-3 { @top-center { content: "Episode 3: The Ash Force"; } }',
    );
  });

  it("cannot be broken out of by a title", () => {
    const rule = episodePageRule({ number: 1, title: 'A "quoted" title</style><script>' });
    expect(rule).toContain('A \\"quoted\\" title');
    expect(rule).not.toContain("</style>");
  });
});

describe("oneLine", () => {
  it("joins lines with a space", () => {
    expect(oneLine("One\n  two\n")).toBe("One two");
  });
});

describe("reader settings", () => {
  it("uses the defaults with nothing saved", () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it("survives corrupt storage", () => {
    expect(parseSettings("{not json")).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings("null")).toEqual(DEFAULT_SETTINGS);
  });

  it("keeps valid choices and drops the rest", () => {
    expect(parseSettings(JSON.stringify({ size: "huge", spacing: "enormous", colors: false, timecodes: "yes" }))).toEqual({
      ...DEFAULT_SETTINGS,
      size: "huge",
      colors: false,
    });
  });

  it("turns settings into CSS values", () => {
    expect(readerVariables({ ...DEFAULT_SETTINGS, size: "large", spacing: "relaxed" })).toEqual({ "--rd-size": "1.25rem", "--rd-leading": "2" });
  });
});

describe("scene navigation", () => {
  const tops = [-500, 40, 900];
  const line = 96;

  it("finds the section at the reading line", () => {
    expect(currentIndex(tops, line)).toBe(1);
    expect(currentIndex([200, 900], line)).toBe(-1);
  });

  it("steps forward", () => {
    expect(stepIndex(tops, line, 1)).toBe(2);
    expect(stepIndex([200, 900], line, 1)).toBe(0);
  });

  it("stops at the last section", () => {
    expect(stepIndex([-900, -500], line, 1)).toBeNull();
  });

  it("goes back to the start of a part-read section first", () => {
    expect(stepIndex(tops, line, -1)).toBe(1);
  });

  it("goes to the previous section from the top of one", () => {
    expect(stepIndex([-500, 96, 900], line, -1)).toBe(0);
  });

  it("stops at the first section", () => {
    expect(stepIndex([96, 900], line, -1)).toBeNull();
  });
});

describe("scrollProgress", () => {
  it("runs from 0 to 1", () => {
    expect(scrollProgress(0, 2000, 1000)).toBe(0);
    expect(scrollProgress(500, 2000, 1000)).toBe(0.5);
    expect(scrollProgress(1000, 2000, 1000)).toBe(1);
  });

  it("is full on a page too short to scroll", () => {
    expect(scrollProgress(0, 500, 1000)).toBe(1);
  });
});

describe("readerKey", () => {
  const press = (key: string, fields = {}) => readerKey({ key, ctrlKey: false, metaKey: false, altKey: false, ...fields });

  it("maps the scene and episode keys", () => {
    expect(press("j")).toEqual({ target: "scene", direction: 1 });
    expect(press("ArrowRight")).toEqual({ target: "scene", direction: 1 });
    expect(press("k")).toEqual({ target: "scene", direction: -1 });
    expect(press("ArrowLeft")).toEqual({ target: "scene", direction: -1 });
    expect(press("]")).toEqual({ target: "episode", direction: 1 });
    expect(press("[")).toEqual({ target: "episode", direction: -1 });
  });

  it("leaves other keys and browser shortcuts alone", () => {
    expect(press("x")).toBeNull();
    expect(press("ArrowDown")).toBeNull();
    expect(press("j", { ctrlKey: true })).toBeNull();
    expect(press("ArrowLeft", { altKey: true })).toBeNull();
  });
});

describe("reading progress", () => {
  let db: Awaited<ReturnType<typeof createTestDb>>;
  let userId: string;
  let otherId: string;
  let seasonId: string;
  let sceneIds: string[];

  beforeEach(async () => {
    db = await createTestDb();
    [{ id: userId }, { id: otherId }] = await db
      .insert(users)
      .values([
        { email: "a@example.com", name: "A", passwordHash: "x" },
        { email: "b@example.com", name: "B", passwordHash: "x" },
      ])
      .returning();
    const [{ id: seriesId }] = await db.insert(series).values({ title: "Test" }).returning();
    [{ id: seasonId }] = await db.insert(seasons).values({ seriesId, number: 1 }).returning();
    const [{ id: episodeId }] = await db.insert(episodes).values({ seasonId, number: 4, title: "Four" }).returning();
    const list = await db
      .insert(scenes)
      .values([1, 2].map((position) => ({ episodeId, position, title: `Scene ${position}` })))
      .returning();
    sceneIds = list.map(({ id }) => id);
  });

  it("is empty until someone starts reading", async () => {
    expect(await loadProgress(db, userId, seasonId)).toBeNull();
  });

  it("remembers the last scene, per person", async () => {
    await saveProgress(db, { userId, sceneId: sceneIds[0] });
    await saveProgress(db, { userId, sceneId: sceneIds[1] });
    await saveProgress(db, { userId: otherId, sceneId: sceneIds[0] });

    expect(await loadProgress(db, userId, seasonId)).toMatchObject({ sceneId: sceneIds[1], episodeNumber: 4 });
    expect(await loadProgress(db, otherId, seasonId)).toMatchObject({ sceneId: sceneIds[0] });
  });

  it("forgets a scene that was deleted, rather than sending someone to a dead link", async () => {
    await saveProgress(db, { userId, sceneId: sceneIds[0] });
    await deleteScene(db, { sceneId: sceneIds[0], version: 1, userId });

    expect(await loadProgress(db, userId, seasonId)).toBeNull();
  });

  it("refuses a deleted scene", async () => {
    await deleteScene(db, { sceneId: sceneIds[0], version: 1, userId });
    expect(await saveProgress(db, { userId, sceneId: sceneIds[0] })).toBe(false);
  });

  it("outlines live episodes and scenes", async () => {
    await deleteScene(db, { sceneId: sceneIds[0], version: 1, userId });
    const outline = await loadOutline(db, seasonId);
    expect(outline).toHaveLength(1);
    expect(outline[0].scenes.map(({ title }) => title)).toEqual(["Scene 2"]);
  });
});
