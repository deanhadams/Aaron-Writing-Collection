import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { characters, episodes, loreEntries, loreRevisions, scenes, seasons, series, users, type LoreDraft } from "@/lib/db/schema";
import { createTestDb } from "@/lib/scenes/test-db";
import { STARTER_ENTRIES } from "./categories";
import { buildLinkLookup, headingsIn, linkKey, openLinkAt, parseWikiLinks, wikiLinksToMarkdown, wikiTarget } from "./links";
import { loadEntry, loadLoreGallery, loadMentions, loadRelated } from "./read";
import { isLoreKey, parseDraft } from "./validate";
import {
  createEntry,
  deleteEntry,
  listDeletedEntries,
  listLoreRevisions,
  restoreEntry,
  restoreLoreRevision,
  saveEntry,
} from "./write";

describe("[[links]]", () => {
  it("finds links, with an optional label", () => {
    expect(parseWikiLinks("Ask [[Desruc]] about [[Department Zero|the zero]].")).toEqual([
      { target: "Desruc", label: "Desruc" },
      { target: "Department Zero", label: "the zero" },
    ]);
  });

  it("ignores links in code", () => {
    expect(parseWikiLinks("`[[Not this]]` and\n```\n[[Nor this]]\n```\n[[This]]").map(({ target }) => target)).toEqual(["This"]);
  });

  it("leaves unfinished brackets alone", () => {
    expect(parseWikiLinks("[[Open and [single] and ]]")).toEqual([]);
  });

  it("turns a link into markdown and back", () => {
    const markdown = wikiLinksToMarkdown("See [[Bear’dion & Co]] now");
    const [, href] = markdown.match(/\((wiki:[^)]+)\)/)!;

    expect(markdown).toContain("[Bear’dion & Co](wiki:");
    expect(wikiTarget(href)).toBe("Bear’dion & Co");
  });

  it("keeps a target from breaking out of the link", () => {
    const markdown = wikiLinksToMarkdown("[[a)(javascript:alert(1)]]");
    const href = markdown.slice(markdown.indexOf("](") + 2, -1);

    expect(href).not.toMatch(/[()]/);
    expect(wikiTarget(href)).toBe("a)(javascript:alert(1)");
  });

  it("finds the name being typed for the autocomplete", () => {
    expect(openLinkAt("See [[Des", 9)).toEqual({ start: 4, typed: "Des" });
    expect(openLinkAt("See [[Des]] and", 14)).toBeNull();
    expect(openLinkAt("[[Des\nmore", 10)).toBeNull();
    expect(openLinkAt("nothing", 7)).toBeNull();
  });

  it("looks up characters, their aliases and lore, ignoring case and apostrophes", () => {
    const lookup = buildLinkLookup({
      characters: [{ name: "BEAR’DION", fullName: "Bear’dion Slagdon", aliases: ["OLD NAME"], slug: "beardion", color: "#123456" }],
      entries: [{ title: "The Colosseum", aliases: ["Arena"], slug: "the-colosseum" }],
    });

    expect(lookup.get(linkKey("Beardion"))).toMatchObject({ kind: "character", href: "/characters/beardion", color: "#123456" });
    expect(lookup.get(linkKey("old name"))?.name).toBe("BEAR’DION");
    expect(lookup.get(linkKey("arena"))).toMatchObject({ kind: "lore", href: "/lore/the-colosseum" });
    expect(lookup.get(linkKey("Nobody"))).toBeUndefined();
  });
});

describe("headingsIn", () => {
  it("lists level 2 and 3 headings, ignoring code", () => {
    expect(headingsIn("# Top\n## One\n### Two **bold**\n```\n## Not this\n```")).toEqual([
      { level: 2, text: "One", id: "one" },
      { level: 3, text: "Two bold", id: "two-bold" },
    ]);
  });

  it("shows a link's name in a heading", () => {
    expect(headingsIn("## About [[Desruc]]")[0].text).toBe("About Desruc");
  });
});

describe("parseDraft", () => {
  const draft = { title: "Ashes", category: "Powers", summary: " Short ", body: "Text", coverKey: null, tags: ["a", "a", " b "], aliases: [] };

  it("tidies a good draft", () => {
    expect(parseDraft(draft, "ashes")).toMatchObject({ title: "Ashes", summary: "Short", tags: ["a", "b"] });
  });

  it("refuses a missing title, unknown category or bad key", () => {
    expect(parseDraft({ ...draft, title: " " }, "ashes")).toBeNull();
    expect(parseDraft({ ...draft, category: "Nonsense" }, "ashes")).toBeNull();
    expect(parseDraft({ ...draft, coverKey: "characters/x.png" }, "ashes")).toBeNull();
  });

  it("only accepts keys under the entry", () => {
    expect(isLoreKey("ashes", "lore/ashes/abc-1.png")).toBe(true);
    expect(isLoreKey("ashes", "lore/other/abc-1.png")).toBe(false);
    expect(isLoreKey("ashes", "lore/ashes/../x.png")).toBe(false);
  });
});

describe("the starter set", () => {
  it("has titles and categories only", () => {
    expect(STARTER_ENTRIES).toHaveLength(11);
    expect(STARTER_ENTRIES.every((entry) => Object.keys(entry).join() === "title,category")).toBe(true);
  });
});

describe("lore entries", () => {
  let db: Awaited<ReturnType<typeof createTestDb>>;
  let dean: string;
  let kim: string;

  const newEntry = async (title = "The Colosseum", body?: string) => {
    const result = await createEntry(db, { title, category: "Places", userId: dean, body });
    if (result.status !== "created") throw new Error(result.status);
    return result;
  };

  const draft = (fields: Partial<LoreDraft> = {}): LoreDraft => ({
    title: "The Colosseum",
    category: "Places",
    summary: null,
    body: "Written.",
    coverKey: null,
    tags: [],
    aliases: [],
    ...fields,
  });

  const row = async (id: string) => (await db.select().from(loreEntries).where(eq(loreEntries.id, id)))[0];
  const revisions = (id: string) => db.select().from(loreRevisions).where(eq(loreRevisions.loreId, id));

  beforeEach(async () => {
    db = await createTestDb();
    [{ id: dean }, { id: kim }] = await db
      .insert(users)
      .values([
        { email: "dean@example.com", name: "Dean", passwordHash: "x" },
        { email: "kim@example.com", name: "Kim", passwordHash: "x" },
      ])
      .returning();
    await db.insert(series).values({ title: "Devil Bunny" });
  });

  it("makes a slug from the title, with a placeholder body", async () => {
    const { id, slug } = await newEntry("Warrior's Departments");
    expect(slug).toBe("warriors-departments");
    expect((await row(id)).body).toBe("Add details here…");
  });

  it("refuses a title already in use, ignoring case", async () => {
    await newEntry();
    expect(await createEntry(db, { title: "the colosseum", category: "Places", userId: dean })).toMatchObject({ status: "title_taken" });
  });

  it("keeps the slug when the title changes", async () => {
    const { id, slug } = await newEntry();
    await saveEntry(db, { id, version: 1, userId: dean, draft: draft({ title: "The Great Arena" }) });
    expect((await row(id)).slug).toBe(slug);
  });

  describe("version conflicts", () => {
    it("saves, moves the version on and credits the editor", async () => {
      const { id } = await newEntry();
      expect(await saveEntry(db, { id, version: 1, userId: kim, draft: draft() })).toEqual({ status: "saved", version: 2 });
      expect(await row(id)).toMatchObject({ body: "Written.", version: 2, updatedBy: kim });
    });

    it("refuses a stale version and overwrites nothing", async () => {
      const { id } = await newEntry();
      await saveEntry(db, { id, version: 1, userId: dean, draft: draft({ body: "Mine" }) });

      const late = await saveEntry(db, { id, version: 1, userId: kim, draft: draft({ body: "Theirs" }) });

      expect(late).toEqual({ status: "conflict", version: 2 });
      expect((await row(id)).body).toBe("Mine");
    });

    it("accepts a retry of a save that already landed", async () => {
      const { id } = await newEntry();
      await saveEntry(db, { id, version: 1, userId: dean, draft: draft() });
      expect(await saveEntry(db, { id, version: 1, userId: dean, draft: draft() })).toEqual({ status: "saved", version: 2 });
    });

    it("changes nothing when nothing changed", async () => {
      const { id } = await newEntry();
      await saveEntry(db, { id, version: 1, userId: dean, draft: draft() });
      await saveEntry(db, { id, version: 2, userId: dean, draft: draft() });
      expect((await row(id)).version).toBe(2);
    });
  });

  describe("revisions and restore", () => {
    it("keeps what a save replaces", async () => {
      const { id } = await newEntry();
      await saveEntry(db, { id, version: 1, userId: dean, draft: draft({ body: "One" }) });

      const [revision] = await revisions(id);
      expect(revision.content.body).toBe("Add details here…");
    });

    it("shares a row for one person's run of autosaves", async () => {
      const { id } = await newEntry();
      await saveEntry(db, { id, version: 1, userId: dean, draft: draft({ body: "One" }) });
      await saveEntry(db, { id, version: 2, userId: dean, draft: draft({ body: "Two" }) });
      await saveEntry(db, { id, version: 3, userId: dean, draft: draft({ body: "Three" }) });

      expect(await revisions(id)).toHaveLength(1);
      expect((await revisions(id))[0].content.body).toBe("Two");
    });

    it("starts a new row for another person", async () => {
      const { id } = await newEntry();
      await saveEntry(db, { id, version: 1, userId: dean, draft: draft({ body: "One" }) });
      await saveEntry(db, { id, version: 2, userId: kim, draft: draft({ body: "Two" }) });
      await saveEntry(db, { id, version: 3, userId: dean, draft: draft({ body: "Three" }) });

      expect(await revisions(id)).toHaveLength(2);
    });

    it("restores an old version as a new one, keeping what it replaced", async () => {
      const { id } = await newEntry();
      await saveEntry(db, { id, version: 1, userId: dean, draft: draft({ body: "One", tags: ["kept"] }) });
      await saveEntry(db, { id, version: 2, userId: kim, draft: draft({ body: "Two" }) });
      await saveEntry(db, { id, version: 3, userId: dean, draft: draft({ body: "Three" }) });

      const history = await listLoreRevisions(db, id);
      const target = history.find(({ content }) => content.body === "One")!;
      const result = await restoreLoreRevision(db, { id, revisionId: target.id, version: 4, userId: dean });

      expect(result).toMatchObject({ status: "saved", version: 5 });
      expect(await row(id)).toMatchObject({ body: "One", tags: ["kept"], version: 5 });
      expect((await revisions(id)).some(({ content, sealed }) => content.body === "Three" && sealed)).toBe(true);
    });

    it("refuses a stale restore", async () => {
      const { id } = await newEntry();
      await saveEntry(db, { id, version: 1, userId: dean, draft: draft() });
      const [{ id: revisionId }] = await revisions(id);

      expect(await restoreLoreRevision(db, { id, revisionId, version: 1, userId: dean })).toMatchObject({ status: "conflict" });
    });

    it("refuses a revision from another entry", async () => {
      const one = await newEntry();
      const two = await newEntry("Another");
      await saveEntry(db, { id: one.id, version: 1, userId: dean, draft: draft() });
      const [{ id: revisionId }] = await revisions(one.id);

      expect((await restoreLoreRevision(db, { id: two.id, revisionId, version: 1, userId: dean })).status).toBe("not_found");
    });
  });

  describe("soft delete", () => {
    it("hides the entry but keeps it for 30 days", async () => {
      const { id, slug } = await newEntry();
      expect(await deleteEntry(db, { id, version: 1, userId: kim })).toEqual({ status: "ok" });

      expect(await loadEntry(db, slug)).toBeNull();
      expect(await loadLoreGallery(db)).toEqual([]);
      expect(await listDeletedEntries(db)).toMatchObject([{ id, deletedBy: "Kim" }]);
    });

    it("refuses a stale delete", async () => {
      const { id } = await newEntry();
      expect((await deleteEntry(db, { id, version: 9, userId: kim })).status).toBe("conflict");
    });

    it("stops saves to a deleted entry", async () => {
      const { id } = await newEntry();
      await deleteEntry(db, { id, version: 1, userId: dean });
      expect((await saveEntry(db, { id, version: 1, userId: dean, draft: draft() })).status).toBe("not_found");
    });

    it("restores it with its slug", async () => {
      const { id, slug } = await newEntry();
      await deleteEntry(db, { id, version: 1, userId: dean });

      expect(await restoreEntry(db, { id, version: 1 })).toEqual({ status: "ok", slug });
      expect(await loadEntry(db, slug)).not.toBeNull();
      expect(await listDeletedEntries(db)).toEqual([]);
    });

    it("frees the title, then refuses a restore that would clash", async () => {
      const { id } = await newEntry();
      await deleteEntry(db, { id, version: 1, userId: dean });
      await newEntry();

      expect((await restoreEntry(db, { id, version: 1 })).status).toBe("title_taken");
    });

    it("drops entries past 30 days from the list, and purges them on the next delete", async () => {
      const old = await newEntry("Old");
      const next = await newEntry("New");
      await db.update(loreEntries).set({ deletedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000) }).where(eq(loreEntries.id, old.id));

      expect(await listDeletedEntries(db)).toEqual([]);
      expect((await restoreEntry(db, { id: old.id, version: 1 })).status).toBe("not_found");

      await deleteEntry(db, { id: next.id, version: 1, userId: dean });
      expect(await row(old.id)).toBeUndefined();
    });
  });

  describe("mentioned in and related", () => {
    beforeEach(async () => {
      const [{ id: seriesId }] = await db.select({ id: series.id }).from(series);
      const [{ id: seasonId }] = await db.insert(seasons).values({ seriesId, number: 1 }).returning();
      const [{ id: episodeId }] = await db.insert(episodes).values({ seasonId, number: 4, title: "THE THIRTY" }).returning();
      await db.insert(scenes).values([
        { episodeId, position: 1, title: "First", beats: [{ id: "1", type: "visual", text: "They reach the Colosseum at dawn." }] },
        { episodeId, position: 2, title: "Second", beats: [{ id: "2", type: "visual", text: "The great arena roars." }] },
        { episodeId, position: 3, title: "Third", beats: [{ id: "3", type: "visual", text: "Nothing to see." }] },
      ]);
      await db.insert(characters).values({ seriesId, name: "REVOC", slug: "revoc" });
    });

    it("finds scenes that say the title or an alias", async () => {
      const found = await loadMentions(db, ["Colosseum", "great arena"]);
      expect(found.map(({ title }) => title).sort()).toEqual(["First", "Second"]);
      expect(found[0]).toMatchObject({ episodeNumber: 4, episodeTitle: "THE THIRTY" });
    });

    it("needs the whole name, in order", async () => {
      expect(await loadMentions(db, ["arena great"])).toEqual([]);
    });

    it("finds entries linked in both directions", async () => {
      const here = await newEntry("Here", "See [[There]].");
      await newEntry("There");
      await newEntry("Elsewhere", "Back to [[Here]].");
      await newEntry("Unrelated");

      const entry = (await loadEntry(db, here.slug))!;
      expect(await loadRelated(db, entry)).toEqual([
        { slug: "elsewhere", title: "Elsewhere", isLinkedFromHere: false, linksHere: true },
        { slug: "there", title: "There", isLinkedFromHere: true, linksHere: false },
      ]);
    });
  });
});
