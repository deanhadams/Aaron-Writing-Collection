import { describe, expect, it } from "vitest";
import { parseScript } from "./parse-script";
import type { SourceLine } from "./source-lines";

const top = (text: string): SourceLine => ({ text, depth: 0 });

const SAMPLE = [
  top("SEASON 1"),
  top("📜 EPISODE 1: NO HELL"),
  top("💥 Prologue"),
  top("(VISUAL): Ash falls."),
  top("OPENING THEME"),
  top("Devil Run"),
  top("📚 Scene 1: Classroom Conflict (The Bully)"),
  top("(2:00 - 6:00) CLASSROOM - DAY"),
  top("DESRUC: Move."),
  top("(21:00) END EPISODE"),
  top("EPISODE OUTRO"),
  top("Last Light"),
  top("POST-CREDIT SCENE"),
  top("SOUND: Static."),
  top("SEASON 1"),
  top("🐰 EPISODE 6: THE WARRIOR'S DEPARTMENTS "),
  top("OPENING SCENE"),
  top("End Scene"),
];

describe("parseScript", () => {
  it("counts a repeated season heading once", () => {
    const script = parseScript(SAMPLE);
    expect(script.seasonNumber).toBe(1);
    expect(script.repeatedSeasonHeadings).toBe(1);
  });

  it("warns about a different season instead of mixing it in", () => {
    const script = parseScript([top("SEASON 1"), top("SEASON 2")]);
    expect(script.seasonNumber).toBe(1);
    expect(script.warnings).toHaveLength(1);
  });

  it("strips emoji and trailing spaces from episode headings", () => {
    const { episodes } = parseScript(SAMPLE);
    expect(episodes.map(({ number, title }) => [number, title])).toEqual([
      [1, "NO HELL"],
      [6, "THE WARRIOR'S DEPARTMENTS"],
    ]);
  });

  it("allows gaps in the episode numbers", () => {
    const { episodes, warnings } = parseScript([
      top("EPISODE 22: BEFORE"),
      top("EPISODE 24: Hell No (Season Finale)"),
    ]);
    expect(episodes.map(({ number }) => number)).toEqual([22, 24]);
    expect(episodes[1].title).toBe("Hell No (Season Finale)");
    expect(warnings).toEqual([]);
  });

  it("splits a timecode line into timecode and location", () => {
    const scene = parseScript(SAMPLE).episodes[0].scenes[1];
    expect(scene).toMatchObject({
      position: 2,
      kind: "scene",
      title: "Classroom Conflict (The Bully)",
      timecode: "2:00 - 6:00",
      location: "CLASSROOM - DAY",
    });
  });

  it("maps special blocks to scene kinds and themes", () => {
    const [first, second] = parseScript(SAMPLE).episodes;
    expect(first.scenes.map(({ kind }) => kind)).toEqual(["prologue", "scene", "post_credit"]);
    expect(first.openingTheme).toBe("Devil Run");
    expect(first.outroTheme).toBe("Last Light");
    expect(second.scenes.map(({ kind }) => kind)).toEqual(["prologue", "post_credit"]);
  });

  it("reads a theme written on the heading line", () => {
    const [episode] = parseScript([top("EPISODE 1: A"), top("OPENING THEME: Devil Run")]).episodes;
    expect(episode.openingTheme).toBe("Devil Run");
  });

  it("drops END EPISODE lines", () => {
    const script = parseScript(SAMPLE);
    expect(script.droppedEndLines).toBe(1);
    const text = script.episodes.flatMap(({ scenes }) => scenes.flatMap(({ beats }) => beats.map((beat) => beat.text)));
    expect(text.join()).not.toContain("END EPISODE");
  });

  it("keeps a sentence that only mentions a block name as a beat", () => {
    const [episode] = parseScript([
      top("EPISODE 1: A"),
      top("Scene 1: B"),
      top("Opening theme plays over the city."),
    ]).episodes;
    expect(episode.openingTheme).toBeNull();
    expect(episode.scenes[0].beats[0]).toMatchObject({ type: "note" });
  });

  it("keeps text outside any scene, with a warning", () => {
    const script = parseScript([top("EPISODE 1: A"), top("(VISUAL): Stray.")]);
    expect(script.episodes[0].scenes[0].beats[0]).toMatchObject({ type: "visual", text: "Stray." });
    expect(script.warnings).toHaveLength(1);
  });

  it("keeps lines after a theme instead of losing them", () => {
    const [episode] = parseScript([
      top("EPISODE 1: A"),
      top("EPISODE OUTRO"),
      top("Last Light"),
      top("(VISUAL): Credits roll."),
    ]).episodes;
    expect(episode.outroTheme).toBe("Last Light");
    expect(episode.scenes[0]).toMatchObject({ kind: "outro", title: "Episode Outro" });
    expect(episode.scenes[0].beats[0]).toMatchObject({ type: "visual" });
  });

  it("reports text before the first episode", () => {
    const script = parseScript([top("DEVIL BUNNY MASTER"), top("SEASON 1"), top("EPISODE 1: A")]);
    expect(script.ignoredLines).toEqual(["DEVIL BUNNY MASTER"]);
  });

  it("gives the same content on a second parse", () => {
    const parse = () => parseScript(SAMPLE, () => "id").episodes;
    expect(parse()).toEqual(parse());
  });
});
