import { strFromU8, unzipSync } from "fflate";
import { beforeEach, describe, expect, it } from "vitest";
import { backupsLog, characterImages, characters, episodes, scenes, sceneRevisions, seasons, series, users, type Beat } from "@/lib/db/schema";
import { createTestDb } from "@/lib/scenes/test-db";
import { deleteScene } from "@/lib/structure/scene";
import { backupChunks, backupFileName } from "./backup";
import { renderDocx } from "./docx";
import { scriptLines, type ExportEpisode, type ExportScene } from "./lines";
import { loadScript, seasonDocx } from "./load";
import { compareScript, parseDocx } from "./round-trip";

const beat = (type: Beat["type"], text: string, fields: Partial<Beat> = {}): Beat => ({ id: crypto.randomUUID(), type, text, ...fields });

const scene = (fields: Partial<ExportScene> & Pick<ExportScene, "beats">): ExportScene => ({
  kind: "scene",
  title: "A Scene",
  timecode: "2:00 - 6:00",
  location: "CLASSROOM - DAY",
  ...fields,
});

const episode = (scenesList: ExportScene[], fields: Partial<ExportEpisode> = {}): ExportEpisode => ({
  number: 1,
  title: "NO HELL",
  openingTheme: null,
  outroTheme: null,
  scenes: scenesList,
  ...fields,
});

const roundTrip = async (episodesList: ExportEpisode[]) =>
  compareScript(episodesList, await parseDocx(await renderDocx(scriptLines(1, episodesList), "Test")));

const lineText = (episodesList: ExportEpisode[]) =>
  scriptLines(1, episodesList).map(({ runs }) => runs.map(({ text }) => text).join(""));

describe("Word layout", () => {
  it("writes the document in the source's order and wording", () => {
    const text = lineText([
      episode(
        [
          scene({ kind: "prologue", title: null, timecode: "0:00 - 0:30", location: null, beats: [beat("sound", "A tearing sound.")] }),
          scene({ title: "Classroom Conflict", beats: [beat("visual", "He reads."), beat("dialogue", "Hello", { character: "DESRUC", parenthetical: "Looks up" })] }),
          scene({ kind: "post_credit", title: "The Watcher", timecode: "20:30 - END", location: null, beats: [beat("visual", "A man walks.")] }),
        ],
        { openingTheme: '"Song" by Band', outroTheme: '"Other" by Band' },
      ),
    ]);

    expect(text).toEqual([
      "SEASON 1",
      "EPISODE 1: NO HELL",
      "Prologue",
      "(0:00 - 0:30) OPENING SCENE",
      "SOUND: A tearing sound.",
      "OPENING THEME",
      'Play Anime Intro: "Song" by Band',
      "Scene 1: Classroom Conflict",
      "(2:00 - 6:00) CLASSROOM - DAY",
      "(VISUAL): He reads.",
      "DESRUC: (Looks up) Hello",
      "EPISODE OUTRO",
      'Episode Outro Plays: "Other" by Band',
      "End Scene (The Watcher)",
      "(20:30 - END) POST-CREDIT SCENE",
      "(VISUAL): A man walks.",
      "END EPISODE.",
    ]);
  });

  it("makes names bold, and visuals and sounds italic", () => {
    const lines = scriptLines(1, [episode([scene({ beats: [beat("dialogue", "Hi", { character: "REVOC" }), beat("visual", "Rain.")] })])]);
    const [dialogue, visual] = lines.filter(({ style }) => style === "bullet");

    expect(dialogue.runs[0]).toMatchObject({ text: "REVOC:", bold: true });
    expect(visual.runs[1]).toMatchObject({ text: " Rain.", italics: true });
  });

  it("indents action as a sub-bullet", () => {
    const lines = scriptLines(1, [episode([scene({ beats: [beat("action", "(He sits.)")] })])]);
    expect(lines.find(({ style }) => style === "sub")?.runs[0].text).toBe("(He sits.)");
  });

  it("numbers only regular scenes", () => {
    const text = lineText([
      episode([
        scene({ kind: "prologue", title: null, beats: [] }),
        scene({ title: "One", beats: [] }),
        scene({ kind: "outro", title: "Episode Outro", beats: [] }),
        scene({ title: "Two", beats: [] }),
      ]),
    ]);
    expect(text).toContain("Scene 1: One");
    expect(text).toContain("Scene 2: Two");
  });
});

describe("round trip through the importer", () => {
  it("reads back an ordinary episode exactly", async () => {
    expect(
      await roundTrip([
        episode(
          [
            scene({ kind: "prologue", title: null, timecode: "0:00 - 0:30", location: null, beats: [beat("vo", "Well, now you have.", { parenthetical: "Unrecognizable Voice" })] }),
            scene({
              beats: [
                beat("visual", "(SPLIT SCREEN) Both of them."),
                beat("sound", "A loud SLAM!"),
                beat("dialogue", "Hello", { character: "DESRUC", parenthetical: "Looks up" }),
                beat("dialogue", "Together", { character: "REVOC & DESRUC" }),
                beat("vo", "Warning.", { character: "INTERCOM" }),
                beat("vo", "Remember.", { character: "SARAH" }),
                beat("action", "(He sits.)"),
                beat("note", "Interview 1: Department 2 (Captain)"),
              ],
            }),
            scene({ kind: "outro", title: "Episode Outro", timecode: "18:00 - 20:30", location: null, beats: [beat("visual", "Credits.")] }),
            scene({ kind: "post_credit", title: "The Watcher", timecode: "20:30 - END", location: null, beats: [beat("visual", "A man.")] }),
          ],
          { openingTheme: '"Song" by Band', outroTheme: '"Other" by Band' },
        ),
      ]),
    ).toEqual([]);
  });

  it("keeps two episodes apart", async () => {
    expect(
      await roundTrip([
        episode([scene({ beats: [beat("visual", "One.")] })]),
        episode([scene({ beats: [beat("visual", "Two.")] })], { number: 2, title: "SECOND" }),
      ]),
    ).toEqual([]);
  });

  it("keeps a gap in episode numbers", async () => {
    expect(await roundTrip([episode([scene({ beats: [] })], { number: 7 })])).toEqual([]);
  });

  describe("beats a plain line would misread", () => {
    it.each<[string, Beat]>([
      ["action that looks like a speaker", beat("action", "DESRUC: runs away")],
      ["action with a leading timecode", beat("action", "(5:00) later")],
      ["action that looks like a heading", beat("action", "Scene 4: flashback")],
      ["a note that looks like a speaker", beat("note", "REVOC: remember this")],
      ["a note that looks like a label", beat("note", "VISUAL: not really")],
      ["a note that says END", beat("note", "END.")],
      ["an empty note", beat("note", "")],
      ["an empty action", beat("action", "")],
      ["an empty visual", beat("visual", "")],
      ["an empty line of dialogue", beat("dialogue", "", { character: "REVOC" })],
      ["dialogue with no speaker", beat("dialogue", "Who said that?")],
      ["a lower-case speaker name", beat("dialogue", "Hi", { character: "Kim" })],
      ["a speaker the parser can't read", beat("dialogue", "Hi", { character: "A VERY LONG NAME FOR ONE PERSON" })],
      ["a voice with a parenthetical", beat("vo", "Hi", { character: "SARAH", parenthetical: "Faint" })],
      ["an unnamed voice in capitals", beat("vo", "Hi", { parenthetical: "STATIC" })],
    ])("%s", async (_name, item) => {
      const differences = await roundTrip([episode([scene({ beats: [beat("visual", "First."), item, beat("visual", "Last.")] })])]);
      expect(differences).toEqual([]);
    });

    it("turns a line break in a beat into a space, not a second beat", async () => {
      expect(await roundTrip([episode([scene({ beats: [beat("visual", "One\ntwo")] })])])).toEqual([]);
    });
  });

  describe("scenes made on the site", () => {
    it.each<[string, Partial<ExportScene>]>([
      ["a scene with no title", { title: null }],
      ["an empty scene", { beats: [] }],
      ["no timecode or location", { timecode: null, location: null }],
      ["a location and no timecode", { timecode: null }],
      ["a timecode and no location", { location: null }],
      ["a timecode in words", { timecode: "about three minutes" }],
      ["a location that reads as a heading", { location: "OPENING THEME" }],
      ["an outro with its own title", { kind: "outro", title: "The Long Goodbye" }],
      ["an empty outro", { kind: "outro", title: null, beats: [] }],
      ["a titled prologue", { kind: "prologue", title: "Before" }],
      ["a post-credit scene with a location", { kind: "post_credit", title: null, location: "ROOFTOP" }],
    ])("%s", async (_name, fields) => {
      expect(await roundTrip([episode([scene({ beats: [beat("visual", "Rain.")], ...fields })])])).toEqual([]);
    });

    it("keeps the themes with only a prologue, or with no scenes", async () => {
      expect(await roundTrip([episode([scene({ kind: "prologue", title: null, beats: [] })], { openingTheme: "A", outroTheme: "B" })])).toEqual([]);
      expect(await roundTrip([episode([], { openingTheme: "A", outroTheme: "B" })])).toEqual([]);
    });
  });
});

describe("from the database", () => {
  let db: Awaited<ReturnType<typeof createTestDb>>;
  let seasonId: string;
  let episodeIds: string[];
  let sceneIds: string[];
  let userId: string;

  beforeEach(async () => {
    db = await createTestDb();
    [{ id: userId }] = await db.insert(users).values({ email: "dean@example.com", name: "Dean", passwordHash: "secret-hash" }).returning();
    const [{ id: seriesId }] = await db.insert(series).values({ title: "Devil Bunny" }).returning();
    [{ id: seasonId }] = await db.insert(seasons).values({ seriesId, number: 1 }).returning();
    const made = await db
      .insert(episodes)
      .values([1, 2].map((number) => ({ seasonId, number, title: `EPISODE TITLE ${number}`, openingTheme: number === 1 ? "A song" : null })))
      .returning();
    episodeIds = made.map(({ id }) => id);
    const list = await db
      .insert(scenes)
      .values([
        { episodeId: made[0].id, position: 1, title: "One", timecode: "2:00 - 6:00", location: "ROOM", beats: [beat("visual", "Rain."), beat("dialogue", "Hi", { character: "REVOC" })] },
        { episodeId: made[0].id, position: 2, title: "Two", beats: [beat("sound", "Bang.")] },
        { episodeId: made[1].id, position: 1, title: "Three", beats: [beat("action", "(He sits.)")] },
      ])
      .returning();
    sceneIds = list.map(({ id }) => id);

    const [card] = await db
      .insert(characters)
      .values({ seriesId, name: "REVOC", slug: "revoc", aliases: ["OLD NAME"], portraitKey: "characters/revoc.png" })
      .returning();
    await db.insert(characterImages).values({ characterId: card.id, r2Key: "characters/revoc/1.png" });
    await db.insert(sceneRevisions).values({ sceneId: list[0].id, beats: [] });
  });

  it("round-trips one episode against the database", async () => {
    const script = await loadScript(db, seasonId, episodeIds[0]);
    const file = await seasonDocx(db, seasonId, episodeIds[0]);

    expect(script?.episodes).toHaveLength(1);
    expect(compareScript(script!.episodes, await parseDocx(file!.buffer))).toEqual([]);
    expect(file?.fileName).toBe("devil-bunny-season-1-episode-1-episode-title-1.docx");
  });

  it("round-trips a whole season against the database", async () => {
    const script = await loadScript(db, seasonId);
    const file = await seasonDocx(db, seasonId);

    expect(compareScript(script!.episodes, await parseDocx(file!.buffer))).toEqual([]);
    expect(file?.fileName).toBe("devil-bunny-season-1.docx");
  });

  it("leaves deleted scenes out", async () => {
    await deleteScene(db, { sceneId: sceneIds[1], version: 1, userId });
    const script = await loadScript(db, seasonId);
    expect(script?.episodes[0].scenes.map(({ title }) => title)).toEqual(["One"]);
  });

  describe("backup zip", () => {
    const unzip = async () => {
      const chunks: Uint8Array[] = [];
      for await (const chunk of backupChunks(db, { userId, now: new Date("2026-11-04T12:00:00Z") })) chunks.push(chunk);

      const bytes = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.length, 0));
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.length;
      }
      return { files: unzipSync(bytes), chunkCount: chunks.length };
    };

    const json = (file: Uint8Array) => JSON.parse(strFromU8(file));

    it("holds every table, a Word file per season and a manifest", async () => {
      const { files } = await unzip();

      expect(Object.keys(files).sort()).toEqual([
        "content/character_images.json",
        "content/character_relationships.json",
        "content/characters.json",
        "content/episodes.json",
        "content/lore_entries.json",
        "content/lore_revisions.json",
        "content/scene_revisions.json",
        "content/scenes.json",
        "content/seasons.json",
        "content/series.json",
        "manifest.json",
        "word/devil-bunny-season-1.docx",
      ]);
    });

    it("counts match the files", async () => {
      const { files } = await unzip();
      const { counts } = json(files["manifest.json"]);

      expect(counts).toMatchObject({ series: 1, seasons: 1, episodes: 2, scenes: 3, characters: 1, character_images: 1, scene_revisions: 1, lore_entries: 0 });
      for (const [table, total] of Object.entries(counts)) {
        expect(json(files[`content/${table}.json`])).toHaveLength(total as number);
      }
    });

    it("keeps beats and aliases whole, and deleted scenes too", async () => {
      await deleteScene(db, { sceneId: sceneIds[1], version: 1, userId });
      const { files } = await unzip();

      const stored = json(files["content/scenes.json"]);
      expect(stored).toHaveLength(3);
      expect(stored.find(({ title }: { title: string }) => title === "One").beats).toHaveLength(2);
      expect(json(files["content/characters.json"])[0].aliases).toEqual(["OLD NAME"]);
    });

    it("lists image keys and public urls, but no images", async () => {
      process.env.R2_PUBLIC_URL = "https://images.example.com";
      const { files } = await unzip();
      const { images, createdAt } = json(files["manifest.json"]);

      expect(images).toEqual([
        { key: "characters/revoc.png", url: "https://images.example.com/characters/revoc.png" },
        { key: "characters/revoc/1.png", url: "https://images.example.com/characters/revoc/1.png" },
      ]);
      expect(createdAt).toBe("2026-11-04T12:00:00.000Z");
      expect(Object.keys(files).some((name) => name.endsWith(".png"))).toBe(false);
    });

    it("never includes accounts or password hashes", async () => {
      const { files } = await unzip();
      const everything = Object.entries(files)
        .filter(([name]) => name.endsWith(".json"))
        .map(([, file]) => strFromU8(file))
        .join("");

      expect(everything).not.toContain("secret-hash");
      expect(everything).not.toContain("dean@example.com");
    });

    it("logs who downloaded it and when", async () => {
      await unzip();
      const [row] = await db.select().from(backupsLog);
      expect(row).toMatchObject({ userId, createdAt: new Date("2026-11-04T12:00:00Z") });
    });

    it("arrives as many chunks, not one buffered file", async () => {
      expect((await unzip()).chunkCount).toBeGreaterThan(5);
    });

    it("names the file by date", () => {
      expect(backupFileName(new Date("2026-11-04T12:00:00Z"))).toBe("aarons-writing-collection-backup-2026-11-04.zip");
    });
  });
});
