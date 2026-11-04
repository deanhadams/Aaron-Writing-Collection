import { describe, expect, it } from "vitest";
import type { Beat } from "@/lib/db/schema";
import { parseBeat, splitParenthetical } from "./parse-beat";

const beat = (text: string, depth = 0) => {
  const parsed: Partial<Beat> = parseBeat({ text, depth }, () => "id");
  delete parsed.id;
  return parsed;
};

describe("parseBeat", () => {
  it("reads visual and sound labels", () => {
    expect(beat("(VISUAL): Ash falls.")).toEqual({ type: "visual", text: "Ash falls." });
    expect(beat("SOUND: A low hum.")).toEqual({ type: "sound", text: "A low hum." });
  });

  it("reads dialogue", () => {
    expect(beat("DESRUC: Move.")).toEqual({ type: "dialogue", character: "DESRUC", text: "Move." });
  });

  it("splits a leading parenthetical from dialogue", () => {
    expect(beat("DESRUC: (Looks up, unphased) You again.")).toEqual({
      type: "dialogue",
      character: "DESRUC",
      parenthetical: "Looks up, unphased",
      text: "You again.",
    });
  });

  it("keeps a bracket later in the line as spoken text", () => {
    expect(beat("DESRUC: You again (again).").text).toBe("You again (again).");
  });

  it("keeps a capitalised name in brackets as part of the name", () => {
    expect(beat("CARETAKER (LIDA): Sit.")).toMatchObject({ type: "dialogue", character: "CARETAKER (LIDA)" });
  });

  it("treats lowercase bracketed text before the colon as a parenthetical", () => {
    expect(beat("DESRUC (whispering): Run.")).toEqual({
      type: "dialogue",
      character: "DESRUC",
      parenthetical: "whispering",
      text: "Run.",
    });
  });

  it("reads V.O. lines", () => {
    expect(beat("V.O. (Unrecognizable Voice): Wake up.")).toEqual({
      type: "vo",
      parenthetical: "Unrecognizable Voice",
      text: "Wake up.",
    });
    expect(beat("DESRUC (V.O.): I knew.")).toEqual({ type: "vo", character: "DESRUC", text: "I knew." });
    expect(beat("V.O. (LIDA): Listen.")).toEqual({ type: "vo", character: "LIDA", text: "Listen." });
  });

  it("reads INTERCOM as a vo line under its own label", () => {
    expect(beat("INTERCOM: (A booming, urgent voice) CANDIDATES!")).toEqual({
      type: "vo",
      character: "INTERCOM",
      parenthetical: "A booming, urgent voice",
      text: "CANDIDATES!",
    });
  });

  it("makes indented sub-bullets action", () => {
    expect(beat("(Daniel pulls his fist back...)", 1)).toEqual({
      type: "action",
      text: "(Daniel pulls his fist back...)",
    });
  });

  it("falls back to note and keeps the text exactly", () => {
    expect(beat("Sparing a thought for teh bell.")).toEqual({
      type: "note",
      text: "Sparing a thought for teh bell.",
    });
  });

  it("does not treat a mixed-case name as a speaker", () => {
    expect(beat("Daniel: Hey.")).toEqual({ type: "note", text: "Daniel: Hey." });
  });

  it.each(["EXPLOSION", "ROAR", "SLAM", "SHIFTS"])("does not treat %s as a speaker", (label) => {
    expect(beat(`${label}: Loud.`)).toEqual({ type: "note", text: `${label}: Loud.` });
  });
});

describe("splitParenthetical", () => {
  it("handles nested brackets", () => {
    expect(splitParenthetical("(a (b) c) rest")).toEqual({ parenthetical: "a (b) c", text: "rest" });
  });

  it("leaves an unclosed bracket alone", () => {
    expect(splitParenthetical("(oops rest")).toEqual({ text: "(oops rest" });
  });
});
