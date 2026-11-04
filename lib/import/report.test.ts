import { describe, expect, it } from "vitest";
import { mergeSpeakers } from "./characters";
import { parseScript } from "./parse-script";
import { buildReport, formatReport, missingEpisodes } from "./report";

const lines = [
  "SEASON 1",
  "EPISODE 1: A",
  "Scene 1: B",
  "CAPTAIN MAKIMA: Go.",
  "Something odd.",
  "(VISUAL): Ash.",
  "EPISODE 3: C",
].map((text) => ({ text, depth: 0 }));

describe("missingEpisodes", () => {
  it("finds gaps from 1 up to the last episode", () => {
    expect(missingEpisodes([1, 2, 4, 6])).toEqual([3, 5]);
  });
});

describe("buildReport", () => {
  const { script, merged } = mergeSpeakers(parseScript(lines));
  const report = buildReport(script, merged);

  it("counts beats, speakers and gaps", () => {
    expect(report.missingEpisodes).toEqual([2]);
    expect(report.beatCounts).toMatchObject({ dialogue: 1, note: 1, visual: 1 });
    expect(report.speakers).toEqual([["MAKIMA", 1]]);
    expect(report.merged).toEqual([{ variant: "CAPTAIN MAKIMA", name: "MAKIMA", lines: 1 }]);
  });

  it("lists each portrait key", () => {
    expect(report.characters[0].portraitKey).toBe("characters/makima-silvertongue.png");
    expect(formatReport(report)).toContain("characters/makima-silvertongue.png  (Makima Silvertongue)");
  });

  it("lists notes with their episode and scene", () => {
    expect(report.notes).toEqual([{ episode: 1, scene: "1. B", text: "Something odd." }]);
    expect(formatReport(report)).toContain("Ep 1, 1. B: Something odd.");
  });
});
