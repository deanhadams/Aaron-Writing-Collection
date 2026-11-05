import { describe, expect, it } from "vitest";
import { composeQuery, quickActions, sceneHref } from "@/lib/search/client";
import { applyFormat, completeLink, insertImage, parseList } from "./format";

const edit = (text: string, start = 0, end = text.length) => ({ text, start, end });

describe("applyFormat", () => {
  it("wraps the selection in bold and italic, and keeps it selected", () => {
    expect(applyFormat(edit("word"), "bold")).toEqual({ text: "**word**", start: 2, end: 6 });
    expect(applyFormat(edit("a word b", 2, 6), "italic").text).toBe("a *word* b");
  });

  it("offers placeholder text with nothing selected", () => {
    expect(applyFormat(edit("", 0, 0), "bold").text).toBe("**bold text**");
  });

  it("makes headings of whole lines", () => {
    expect(applyFormat(edit("one\ntwo", 5, 5), "h2").text).toBe("one\n## two");
  });

  it("makes a list and a quote of every selected line", () => {
    expect(applyFormat(edit("a\nb"), "list").text).toBe("- a\n- b");
    expect(applyFormat(edit("a\nb"), "quote").text).toBe("> a\n> b");
  });

  it("gives a table its own block", () => {
    expect(applyFormat(edit("text", 4, 4), "table").text).toMatch(/^text\n\n\| Column/);
  });

  it("selects the address of a new link", () => {
    const result = applyFormat(edit("site"), "link");
    expect(result.text).toBe("[site](https://)");
    expect(result.text.slice(result.start, result.end)).toBe("https://");
  });
});

describe("insertImage", () => {
  it("puts the image on its own", () => {
    expect(insertImage(edit("text", 4, 4), "https://x/a.png").text).toBe("text\n\n![Image description](https://x/a.png)\n");
  });
});

describe("completeLink", () => {
  it("finishes the link and puts the caret after it", () => {
    const result = completeLink("See [[Des", 4, 9, "DESRUC");
    expect(result).toEqual({ text: "See [[DESRUC]]", start: 14, end: 14 });
  });

  it("does not double closing brackets already typed", () => {
    expect(completeLink("[[De]]", 0, 4, "DESRUC").text).toBe("[[DESRUC]]");
  });
});

describe("parseList", () => {
  it("splits on commas and drops blanks", () => {
    expect(parseList(" a, b ,, c ")).toEqual(["a", "b", "c"]);
  });
});

describe("quickActions", () => {
  it("offers everything with nothing typed", () => {
    expect(quickActions("").length).toBeGreaterThanOrEqual(3);
  });

  it("narrows by what is typed", () => {
    expect(quickActions("new lo").map(({ id }) => id)).toEqual(["new-lore"]);
    expect(quickActions("char").map(({ id }) => id)).toEqual(["characters"]);
    expect(quickActions("zebra")).toEqual([]);
  });
});

describe("sceneHref", () => {
  const target = { id: "s1", episodeId: "e1", seasonId: "t1", beatId: "b1" };

  it("opens the reader for someone last reading", () => {
    expect(sceneHref(target, "reader")).toBe("/read/t1/e1#beat-b1");
  });

  it("opens the scene otherwise", () => {
    expect(sceneHref(target, "scene")).toBe("/scenes/s1#beat-b1");
    expect(sceneHref(target, "edit")).toBe("/scenes/s1#beat-b1");
  });

  it("falls back to the scene with no line to point at", () => {
    expect(sceneHref({ ...target, beatId: undefined }, "reader")).toBe("/read/t1/e1#scene-s1");
  });
});

describe("composeQuery", () => {
  it("adds the page's filters to the words", () => {
    expect(composeQuery({ q: "ash", speaker: "Revoc", kind: "outro", from: "2", to: "4" })).toBe('ash speaker:"Revoc" kind:outro ep:2-4');
  });

  it("treats one end of the range as a single episode", () => {
    expect(composeQuery({ from: "3" })).toBe("ep:3-3");
  });

  it("is empty with nothing set", () => {
    expect(composeQuery({})).toBe("");
  });
});
