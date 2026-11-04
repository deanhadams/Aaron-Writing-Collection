import { describe, expect, it } from "vitest";
import {
  CHARACTER_PALETTE,
  mergeSpeakers,
  portraitKey,
  possibleVariants,
  seedCharacters,
} from "./characters";
import { parseScript } from "./parse-script";

const parse = (...lines: string[]) =>
  parseScript(["EPISODE 1: A", "Scene 1: B", ...lines].map((text) => ({ text, depth: 0 })));

const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5]
    .map((start) => parseInt(hex.slice(start, start + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

describe("mergeSpeakers", () => {
  it("rewrites variants and counts them", () => {
    const { script, merged } = mergeSpeakers(
      parse("CAPTAIN SARAH CALYDON: Hold.", "SARAH: Now.", "KRAD (ASSA): No.", "THE WATCHER: Soon."),
    );
    expect(script.episodes[0].scenes[0].beats.map(({ character }) => character)).toEqual([
      "SARAH", "SARAH", "KRAD", "WATCHER",
    ]);
    expect(merged.get("CAPTAIN SARAH CALYDON")).toEqual({ name: "SARAH", lines: 1 });
  });
});

describe("seedCharacters", () => {
  it("adds known full names and builds portrait keys from them", () => {
    const { script } = mergeSpeakers(parse("REVOC ERIFLLEH: Up.", "LUCI: Down."));
    const cast = seedCharacters(script);
    expect(cast.find(({ name }) => name === "REVOC")).toMatchObject({
      fullName: "Revoc Eriflleh",
      portraitKey: "characters/revoc-eriflleh.png",
    });
    expect(cast.find(({ name }) => name === "LUCI")).toMatchObject({
      fullName: null,
      portraitKey: "characters/luci.png",
    });
  });

  it("gives the busiest speakers different colors", () => {
    const cast = seedCharacters(parse("AB: x", "CD: x", "CD: y"));
    expect(cast[0].name).toBe("CD");
    expect(cast[0].color).not.toBe(cast[1].color);
  });

  it("keeps labels that are not characters out", () => {
    const names = seedCharacters(parse("SOUND: Boom.", "INTERCOM: Hello.", "ROAR: Loud.")).map(({ name }) => name);
    expect(names).toEqual([]);
  });
});

describe("portraitKey", () => {
  it("slugs names", () => {
    expect(portraitKey("CARETAKER (LIDA)")).toBe("characters/caretaker-lida.png");
  });
});

describe("possibleVariants", () => {
  it("finds a name inside a longer one", () => {
    expect(possibleVariants(["DANIEL", "DANIEL KANE", "LIDA"])).toEqual([["DANIEL KANE", "DANIEL"]]);
  });
});

describe("CHARACTER_PALETTE", () => {
  it.each(CHARACTER_PALETTE)("%s passes AA against white", (color) => {
    expect(1.05 / (luminance(color) + 0.05)).toBeGreaterThanOrEqual(4.5);
  });
});
