import { describe, expect, it } from "vitest";
import { speakerLineCounts } from "@/lib/script/scene-summary";
import { mergeSpeakers, portraitKey, seedCharacters } from "./characters";
import { parseBeat } from "./parse-beat";
import { parseScript } from "./parse-script";
import type { SourceLine } from "./source-lines";

// Each case comes from something the first dry run of Season_1.docx got wrong.
const top = (text: string): SourceLine => ({ text, depth: 0 });
const parse = (...lines: string[]) => parseScript(lines.map(top));

const beat = (text: string, depth = 0) => {
  const { type, character, parenthetical, text: body } = parseBeat({ text, depth }, () => "id");
  return { type, character, parenthetical, text: body };
};

describe("episode structure", () => {
  it("gives the cold open before the first episode heading to that episode", () => {
    const script = parse(
      "SEASON 1",
      "💥 Prologue",
      "(0:00 - 0:30) OPENING SCENE",
      "SOUND: A loud, tearing sound.",
      "(0:30 - 2:00) OPENING THEME",
      'Play Anime Intro: "Can’t Go To Hell" by Sin Shake Sin.',
      "📜 EPISODE 1: NO HELL",
      "📚 Scene 1: Classroom Conflict",
    );
    const [episode] = script.episodes;

    expect(script.ignoredLines).toEqual([]);
    expect(episode).toMatchObject({ number: 1, title: "NO HELL" });
    expect(episode.openingTheme).toBe('"Can’t Go To Hell" by Sin Shake Sin.');
    expect(episode.scenes.map(({ position, kind, timecode }) => [position, kind, timecode])).toEqual([
      [1, "prologue", "0:00 - 0:30"],
      [2, "scene", null],
    ]);
  });

  it("treats a lowercase episode heading like any other", () => {
    expect(parse("🐰 Episode 23: WHAT YOU WANT MOST").episodes[0]).toMatchObject({
      number: 23,
      title: "WHAT YOU WANT MOST",
    });
  });

  it("joins an end scene to its timecode line and drops the brackets", () => {
    const [scene] = parse(
      "EPISODE 1: A",
      "🌑 End Scene (The Watcher)",
      "(20:30 - END) POST-CREDIT SCENE",
      "(VISUAL): Eyes open.",
    ).episodes[0].scenes;
    expect(scene).toMatchObject({ kind: "post_credit", title: "The Watcher", timecode: "20:30 - END", location: null });
    expect(scene.beats).toHaveLength(1);
  });

  it("reads timecodes that end in END and have no spaces or an en dash", () => {
    const { scenes } = parse(
      "EPISODE 1: A",
      "Scene 1: B",
      "(15:30 - END) PRACTICAL ZONE - DESTRUCTION",
      "Scene 2: C",
      "(0:00-3:30) MONITORING ROOM - CONTINUED",
      "Scene 3: D",
      "(0:00–10:30) DEPARTMENT 1 TRAINING FACILITY",
    ).episodes[0];
    expect(scenes.map(({ timecode, location }) => [timecode, location])).toEqual([
      ["15:30 - END", "PRACTICAL ZONE - DESTRUCTION"],
      ["0:00 - 3:30", "MONITORING ROOM - CONTINUED"],
      ["0:00 - 10:30", "DEPARTMENT 1 TRAINING FACILITY"],
    ]);
  });

  it("reads a post credit scene with only a timecode line", () => {
    const [scene] = parse("EPISODE 1: A", "🌟 Post Credit Scene", "(21:00 - END)").episodes[0].scenes;
    expect(scene).toMatchObject({ kind: "post_credit", title: null, timecode: "21:00 - END" });
  });

  it.each(["(21:00) END EPISODE.", "(21:30) END.", "(22:00) END EPISODE. SEASON FINALE."])("drops %s", (line) => {
    const script = parse("EPISODE 1: A", "Scene 1: B", line);
    expect(script.droppedEndLines).toBe(1);
    expect(script.episodes[0].scenes[0].beats).toEqual([]);
  });

  it("keeps a sentence about an episode ending", () => {
    const script = parse("EPISODE 1: A", "Scene 1: B", "EPISODE ENDS with Daniel standing.");
    expect(script.episodes[0].scenes[0].beats[0].text).toBe("EPISODE ENDS with Daniel standing.");
  });

  it("saves the outro song and keeps stills after it, with the outro timecode", () => {
    const { outroTheme, scenes } = parse(
      "EPISODE 4: A",
      "(18:00-20:30) EPISODE OUTRO",
      'Episode Outro Plays: "Voices In My Head" by Jack Harris.',
      "(VISUAL): Quick emotional stills.",
    ).episodes[0];
    expect(outroTheme).toBe('"Voices In My Head" by Jack Harris.');
    expect(scenes[0]).toMatchObject({ kind: "outro", title: "Episode Outro", timecode: "18:00 - 20:30" });
  });

  it("reads the Episode 16 ending as a scene", () => {
    const [scene] = parse("EPISODE 16: A", "🌟 Ending: The Five-Way Roar", "(21:00) THE WASTELAND").episodes[0].scenes;
    expect(scene).toMatchObject({
      kind: "scene",
      title: "Ending: The Five-Way Roar",
      timecode: "21:00",
      location: "THE WASTELAND",
    });
  });
});

describe("beat lines", () => {
  it("reads the (ACTION) label", () => {
    expect(beat("(ACTION): Revoc charges.")).toMatchObject({ type: "action", text: "Revoc charges." });
  });

  it.each([
    ["(VISUAL: APARTMENT) Revoc is sitting.", "(APARTMENT) Revoc is sitting."],
    ["(VISUAL: DANIEL & TYLER’S TUNNEL)", "(DANIEL & TYLER’S TUNNEL)"],
    ["(VISUAL: CINEMATIC REVEAL): For a split second.", "(CINEMATIC REVEAL): For a split second."],
  ])("keeps the bracket closed in %s", (line, text) => {
    expect(beat(line)).toMatchObject({ type: "visual", text });
  });

  it("leaves a different label starting with VISUAL as a note", () => {
    expect(beat("(VISUAL FLASHBACK): A hazy image.").type).toBe("note");
  });

  it("reads numbered code names as speakers", () => {
    expect(beat("2009: 2009. Call me that.")).toMatchObject({ type: "dialogue", character: "2009", text: "2009. Call me that." });
    expect(beat("2020 (Vision): COME ON!")).toMatchObject({ character: "2020", parenthetical: "Vision" });
    expect(beat("2015 (VO): When I gained consciousness")).toMatchObject({ type: "vo", character: "2015" });
  });

  it("does not read a time as a speaker", () => {
    expect(beat("12:30 was the deadline.").type).toBe("note");
  });

  it("keeps both a tag and a parenthetical", () => {
    expect(beat("SARAH CALYDON (Captain, level 10): (Wild and energetic) Oh, C’mon!")).toMatchObject({
      character: "SARAH CALYDON",
      parenthetical: "Captain, level 10; Wild and energetic",
      text: "Oh, C’mon!",
    });
  });

  it.each([
    "RANK 1: REVOC ERIFLLEH - 290 POINTS",
    "TYLER: Level 6",
    "REVOC / DESRUC: Level 4",
    'THE 2015 FIGHT: Seeing Xaviera’s "Engineric" cannon fire.',
  ])("makes the list row %s action, not dialogue", (line) => {
    expect(beat(line, 1)).toMatchObject({ type: "action", text: line });
  });

  it("still reads indented dialogue", () => {
    expect(beat('RYAN: "I want to be her adopted son!"', 1)).toMatchObject({ type: "dialogue", character: "RYAN" });
  });
});

describe("shared lines and merges", () => {
  it.each([
    ["REVOC & DESRUC: Huh?", ["REVOC", "DESRUC"]],
    ["REVOC / DESRUC: Huh?", ["REVOC", "DESRUC"]],
    ["REVOC, DESRUC, XAVIERA, DANIEL, RYAN: DEAL.", ["REVOC", "DESRUC", "XAVIERA", "DANIEL", "RYAN"]],
  ])("credits %s to each speaker", (line, names) => {
    const parsed = parseBeat(top(line), () => "id");
    expect([...speakerLineCounts([parsed]).keys()]).toEqual(names);
  });

  it("seeds people, never a shared line, and merges inside one", () => {
    const script = parse("EPISODE 1: A", "Scene 1: B", "BEAR'DION / TYLER / KRAD: (Together) KICK SOME ASS!", "BEAR’DION: Ow.");
    const { script: merged } = mergeSpeakers(script);

    expect(merged.episodes[0].scenes[0].beats[0].character).toBe("BEAR’DION / TYLER / KRAD");
    expect(seedCharacters(merged).map(({ name, lineCount }) => [name, lineCount])).toEqual([
      ["BEAR’DION", 2],
      ["KRAD", 1],
      ["TYLER", 1],
    ]);
  });

  it("drops apostrophes from portrait keys", () => {
    expect(portraitKey("Bear’dion Slagdon")).toBe("characters/beardion-slagdon.png");
  });
});
