import { describe, expect, it } from "vitest";
import { portraitKey } from "@/lib/import/characters";
import { splitSpeakers } from "@/lib/script/scene-summary";
import { CHARACTER_COLORS, readableColor, textOnColor } from "./colors";
import { castLookups } from "./lookup";
import { presignUrl } from "./presign";
import { conventionalPortraitKey, slugify, uniqueSlug } from "./slug";
import {
  linesPerEpisode,
  matchesSearch,
  sortCards,
  speakersWithoutCards,
  summarizeAppearances,
  type AppearanceRow,
} from "./stats";
import { isOwnKey, MAX_UPLOAD_BYTES, parseUploadRequest, uploadKey } from "./upload";
import { normalizeName, parseCharacterPayload } from "./validate";

const row = (over: Partial<AppearanceRow>): AppearanceRow => ({
  characterId: "a",
  sceneId: "s1",
  lineCount: 1,
  episodeId: "e1",
  episodeNumber: 1,
  seasonNumber: 1,
  position: 1,
  ...over,
});

describe("slugify", () => {
  it.each([
    ["Bear’dion Slagdon", "beardion-slagdon"],
    ["Bear'dion Slagdon", "beardion-slagdon"],
    ["Revoc Eriflleh", "revoc-eriflleh"],
    ["WHITE-HAIRED MAN", "white-haired-man"],
    ["2015", "2015"],
    ["  CARETAKER (LIDA) ", "caretaker-lida"],
  ])("%s becomes %s", (name, slug) => {
    expect(slugify(name)).toBe(slug);
  });

  it("matches the keys the importer already wrote", () => {
    for (const name of ["Bear’dion Slagdon", "Revoc Eriflleh", "CHAOS BRINGER"]) {
      expect(conventionalPortraitKey(slugify(name))).toBe(portraitKey(name));
    }
  });

  it("adds a number when a slug is taken", () => {
    expect(uniqueSlug("zed", [])).toBe("zed");
    expect(uniqueSlug("zed", ["zed"])).toBe("zed-2");
    expect(uniqueSlug("zed", ["zed", "zed-2"])).toBe("zed-3");
  });

  it("never gives an empty slug", () => {
    expect(uniqueSlug(slugify("???"), [])).toBe("character");
  });
});

describe("summarizeAppearances", () => {
  const statsFor = summarizeAppearances([
    row({ sceneId: "s1", lineCount: 3, episodeId: "e2", episodeNumber: 2, position: 4 }),
    row({ sceneId: "s2", lineCount: 2, episodeId: "e2", episodeNumber: 2, position: 1 }),
    row({ sceneId: "s3", lineCount: 5, episodeId: "e1", episodeNumber: 1, position: 3 }),
    row({ characterId: "b", sceneId: "s1", lineCount: 7 }),
  ]);

  it("adds up lines, scenes and distinct episodes", () => {
    expect(statsFor("a")).toMatchObject({ lines: 10, scenes: 3, episodes: 2 });
    expect(statsFor("b")).toMatchObject({ lines: 7, scenes: 1, episodes: 1 });
  });

  it("finds the first appearance whatever the row order", () => {
    expect(statsFor("a").first).toEqual({ seasonNumber: 1, episodeNumber: 1, position: 3 });
  });

  it("gives empty stats to someone with no scenes", () => {
    expect(statsFor("nobody")).toEqual({ lines: 0, scenes: 0, episodes: 0, first: null });
  });

  it("orders by a later season last", () => {
    const later = summarizeAppearances([row({ seasonNumber: 2 }), row({ seasonNumber: 1, episodeNumber: 9, sceneId: "s2" })]);
    expect(later("a").first?.seasonNumber).toBe(1);
  });
});

describe("sortCards", () => {
  const stats = (lines: number, episodeNumber?: number) => ({
    lines,
    scenes: 1,
    episodes: 1,
    first: episodeNumber ? { seasonNumber: 1, episodeNumber, position: 1 } : null,
  });
  const cards = [
    { name: "BRAVO", stats: stats(5, 3) },
    { name: "ALPHA", stats: stats(5, 2) },
    { name: "ZULU", stats: stats(9, 7) },
    { name: "NEW", stats: stats(0) },
  ];
  const names = (sort: Parameters<typeof sortCards>[1]) => sortCards(cards, sort).map(({ name }) => name);

  it("sorts by lines with name as the tie break", () => {
    expect(names("lines")).toEqual(["ZULU", "ALPHA", "BRAVO", "NEW"]);
  });

  it("sorts by name", () => {
    expect(names("name")).toEqual(["ALPHA", "BRAVO", "NEW", "ZULU"]);
  });

  it("sorts by first appearance with no appearance last", () => {
    expect(names("first")).toEqual(["ALPHA", "BRAVO", "ZULU", "NEW"]);
  });
});

describe("matchesSearch", () => {
  const card = { name: "KRAD", fullName: "Krad Nissassa", aliases: ["ASSA"], role: "ally", gift: "Shadow" };

  it.each(["krad", "nissassa", "assa", "ally", "shad", ""])("finds %s", (query) => {
    expect(matchesSearch(card, query)).toBe(true);
  });

  it("misses a non-match", () => {
    expect(matchesSearch(card, "revoc")).toBe(false);
  });
});

describe("linesPerEpisode", () => {
  const episodes = [
    { seasonNumber: 1, episodeNumber: 1, title: "A" },
    { seasonNumber: 1, episodeNumber: 2, title: "B" },
    { seasonNumber: 2, episodeNumber: 1, title: "C" },
  ];

  it("keeps a gap as zero, adds scenes up, and skips seasons they are not in", () => {
    const rows = [
      { seasonNumber: 1, episodeNumber: 2, lineCount: 4 },
      { seasonNumber: 1, episodeNumber: 2, lineCount: 3 },
    ];
    expect(linesPerEpisode(episodes, rows).map(({ lines }) => lines)).toEqual([0, 7]);
  });
});

describe("speakersWithoutCards", () => {
  it("splits shared lines, skips cards, aliases and voice labels, and ranks by lines", () => {
    const result = speakersWithoutCards(
      [
        { character: "REVOC & NEWCOMER", lines: 2 },
        { character: "NEWCOMER", lines: 1 },
        { character: "ZED", lines: 5 },
        { character: "INTERCOM", lines: 4 },
        { character: "CB", lines: 9 },
      ],
      new Set(["REVOC", "CB"]),
      new Set(["INTERCOM"]),
      splitSpeakers,
    );
    expect(result).toEqual([
      { name: "ZED", lines: 5 },
      { name: "NEWCOMER", lines: 3 },
    ]);
  });
});

describe("upload validation", () => {
  const good = { kind: "image", contentType: "image/png", size: 1000 };

  it.each(["image/png", "image/jpeg", "image/webp", "image/gif"])("accepts %s", (contentType) => {
    expect(parseUploadRequest({ ...good, contentType }).ok).toBe(true);
  });

  it.each([
    ["svg, which can carry scripts", { ...good, contentType: "image/svg+xml" }],
    ["html", { ...good, contentType: "text/html" }],
    ["a missing type", { ...good, contentType: undefined }],
    ["an unknown kind", { ...good, kind: "banner" }],
    ["an empty file", { ...good, size: 0 }],
    ["a negative size", { ...good, size: -1 }],
    ["a text size", { ...good, size: "1000" }],
    ["one byte over 10 MB", { ...good, size: MAX_UPLOAD_BYTES + 1 }],
    ["no body", null],
  ])("rejects %s", (_name, body) => {
    expect(parseUploadRequest(body).ok).toBe(false);
  });

  it("accepts exactly 10 MB", () => {
    expect(parseUploadRequest({ ...good, size: MAX_UPLOAD_BYTES }).ok).toBe(true);
  });

  it("follows the key convention", () => {
    const portrait = { kind: "portrait", contentType: "image/png", size: 1 } as const;
    const image = { kind: "image", contentType: "image/jpeg", size: 1 } as const;
    expect(uploadKey("revoc-eriflleh", portrait, "id")).toBe("characters/revoc-eriflleh.png");
    expect(uploadKey("revoc-eriflleh", image, "abc-1")).toBe("characters/revoc-eriflleh/abc-1.jpg");
  });

  it("only accepts keys belonging to this character", () => {
    expect(isOwnKey("revoc", "characters/revoc.png", "portrait")).toBe(true);
    expect(isOwnKey("revoc", "characters/revoc/abc-1.webp", "image")).toBe(true);
    expect(isOwnKey("revoc", "characters/desruc.png", "portrait")).toBe(false);
    expect(isOwnKey("revoc", "characters/revoc/../desruc.png", "image")).toBe(false);
    expect(isOwnKey("revoc", "characters/revoc.png", "image")).toBe(false);
    expect(isOwnKey("revoc", 5, "image")).toBe(false);
  });
});

describe("presignUrl", () => {
  const signed = (headers?: Record<string, string>) =>
    presignUrl({
      method: "GET",
      host: "examplebucket.s3.amazonaws.com",
      path: "/test.txt",
      region: "us-east-1",
      accessKeyId: "AKIAIOSFODNN7EXAMPLE",
      secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
      expiresSeconds: 86400,
      headers,
      now: new Date("2013-05-24T00:00:00Z"),
    });

  it("matches the example in the AWS SigV4 documentation", () => {
    expect(signed()).toContain("X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404");
  });

  it("signs extra headers, so changing them invalidates the URL", () => {
    expect(signed({ "content-type": "image/png" })).toContain("X-Amz-SignedHeaders=content-type%3Bhost");
    expect(signed({ "content-type": "image/png" })).not.toBe(signed({ "content-type": "text/html" }));
  });
});

describe("colors", () => {
  const luminance = (hex: string) => {
    const [r, g, b] = [1, 3, 5]
      .map((start) => parseInt(hex.slice(start, start + 2), 16) / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  it("offers twelve colors", () => {
    expect(new Set(CHARACTER_COLORS).size).toBe(12);
  });

  it.each(CHARACTER_COLORS)("makes %s pass AA as text on white", (color) => {
    expect(1.05 / (luminance(readableColor(color)!) + 0.05)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(CHARACTER_COLORS)("keeps %s above AA on its own light tint", (color) => {
    const text = readableColor(color)!;
    const tint = `#${[1, 3, 5]
      .map((start) => {
        const value = parseInt(text.slice(start, start + 2), 16);
        return Math.round(value * 0.12 + 255 * 0.88).toString(16).padStart(2, "0");
      })
      .join("")}`;
    expect((luminance(tint) + 0.05) / (luminance(text) + 0.05)).toBeGreaterThanOrEqual(4.5);
  });

  it("leaves a color that already passes alone", () => {
    expect(readableColor("#4338CA")).toBe("#4338CA");
  });

  it("uses ink on bright colors and white on dark ones", () => {
    expect(textOnColor("#00D9FF")).toBe("#0b1b3a");
    expect(textOnColor("#4338CA")).toBe("#ffffff");
  });
});

describe("castLookups", () => {
  it("finds a character by name and alias", () => {
    const { colors, links } = castLookups([
      { name: "CHAOS BRINGER", fullName: null, color: "#4338CA", slug: "chaos-bringer", aliases: ["CB"] },
    ]);
    expect(links.get("CB")).toBe("chaos-bringer");
    expect(colors.get("CB")).toBe("#4338CA");
    expect(links.get("CHAOS BRINGER")).toBe("chaos-bringer");
  });
});

describe("parseCharacterPayload", () => {
  const valid = { version: 1, name: " krad ", aliases: ["assa"], relationships: [] };

  it("normalizes names and aliases", () => {
    expect(parseCharacterPayload(valid)).toMatchObject({ name: "KRAD", aliases: ["ASSA"] });
    expect(normalizeName("  two   words ")).toBe("TWO WORDS");
  });

  it.each([
    ["no version", { ...valid, version: undefined }],
    ["no name", { ...valid, name: " " }],
    ["an unknown role", { ...valid, role: "wizard" }],
    ["a bad color", { ...valid, color: "red" }],
    ["aliases that are not a list", { ...valid, aliases: "x" }],
  ])("rejects %s", (_name, body) => {
    expect(parseCharacterPayload(body)).toBeNull();
  });
});
