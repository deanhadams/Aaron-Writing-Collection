import { describe, expect, it } from "vitest";
import {
  seasonPhase,
  summarizeEpisode,
  summarizeSeason,
  type EpisodeSceneRow,
} from "./episode-stats";

const scene = (overrides: Partial<EpisodeSceneRow> = {}): EpisodeSceneRow => ({
  lineCount: 0,
  timecode: null,
  firstVisual: null,
  updatedAt: new Date("2026-01-01"),
  editor: null,
  ...overrides,
});

describe("summarizeEpisode", () => {
  it("adds up scenes and lines", () => {
    const stats = summarizeEpisode([scene({ lineCount: 4 }), scene({ lineCount: 3 })]);
    expect(stats.sceneCount).toBe(2);
    expect(stats.lineCount).toBe(7);
  });

  it("takes the runtime from the end of the latest timecode", () => {
    const stats = summarizeEpisode([
      scene({ timecode: "0:00 - 9:00" }),
      scene({ timecode: "20:30 - 21:00" }),
      scene({ timecode: "9:00 - 12:30" }),
    ]);
    expect(stats.runtimeMinutes).toBe(21);
  });

  it("reads single times and hours", () => {
    expect(summarizeEpisode([scene({ timecode: "21:00" })]).runtimeMinutes).toBe(21);
    expect(summarizeEpisode([scene({ timecode: "0:50:00 - 1:02:00" })]).runtimeMinutes).toBe(62);
  });

  it("never rounds a short episode down to nothing", () => {
    expect(summarizeEpisode([scene({ timecode: "0:00 - 0:20" })]).runtimeMinutes).toBe(1);
  });

  it("has no runtime without a usable timecode", () => {
    expect(summarizeEpisode([scene(), scene({ timecode: "LATER" })]).runtimeMinutes).toBeNull();
  });

  it("uses the first scene's visual only", () => {
    const later = scene({ firstVisual: "Later scene" });
    expect(summarizeEpisode([scene(), later]).firstVisual).toBeNull();
    expect(summarizeEpisode([later, scene()]).firstVisual).toBe("Later scene");
  });

  it("reports the most recent edit and who made it", () => {
    const stats = summarizeEpisode([
      scene({ updatedAt: new Date("2026-03-01"), editor: "Dean" }),
      scene({ updatedAt: new Date("2026-05-01"), editor: "Kim" }),
      scene({ updatedAt: new Date("2026-02-01"), editor: "Aaron" }),
    ]);
    expect(stats.lastEdited).toEqual({ at: new Date("2026-05-01"), by: "Kim" });
  });

  it("copes with an episode that has no scenes", () => {
    expect(summarizeEpisode([])).toEqual({
      sceneCount: 0,
      lineCount: 0,
      runtimeMinutes: null,
      firstVisual: null,
      lastEdited: null,
    });
  });
});

describe("seasonPhase", () => {
  it("is planning when nothing has started", () => {
    expect(seasonPhase([])).toBe("planning");
    expect(seasonPhase(["idea", "idea"])).toBe("planning");
  });

  it("is in progress once anything has moved", () => {
    expect(seasonPhase(["idea", "drafting"])).toBe("in_progress");
    expect(seasonPhase(["done", "idea"])).toBe("in_progress");
  });

  it("is complete only when every episode is done", () => {
    expect(seasonPhase(["done", "done"])).toBe("complete");
    expect(seasonPhase(["done", "drafting"])).toBe("in_progress");
  });
});

describe("summarizeSeason", () => {
  const episodes = [
    { id: "e1", status: "done" as const },
    { id: "e2", status: "drafting" as const },
    { id: "e3", status: "idea" as const },
  ];
  const row = (id: string, episodeId: string, overrides: Partial<EpisodeSceneRow> = {}) => ({
    ...scene(overrides),
    id,
    episodeId,
  });

  it("adds runtimes per episode rather than taking the latest timecode", () => {
    const stats = summarizeSeason(episodes, [
      row("a", "e1", { timecode: "0:00 - 21:00" }),
      row("b", "e2", { timecode: "0:00 - 20:00" }),
    ]);
    expect(stats.runtimeMinutes).toBe(41);
  });

  it("totals scenes, lines and done episodes", () => {
    const stats = summarizeSeason(episodes, [
      row("a", "e1", { lineCount: 4 }),
      row("b", "e2", { lineCount: 5 }),
    ]);
    expect(stats).toMatchObject({
      phase: "in_progress",
      episodeCount: 3,
      doneCount: 1,
      sceneCount: 2,
      lineCount: 9,
    });
  });

  it("continues from the most recently edited scene", () => {
    const stats = summarizeSeason(episodes, [
      row("old", "e1", { updatedAt: new Date("2026-01-01"), editor: "Dean" }),
      row("new", "e3", { updatedAt: new Date("2026-05-01"), editor: "Kim" }),
      row("mid", "e2", { updatedAt: new Date("2026-03-01"), editor: "Aaron" }),
    ]);
    expect(stats.continueSceneId).toBe("new");
    expect(stats.lastEdited).toEqual({ at: new Date("2026-05-01"), by: "Kim" });
  });

  it("copes with a season that has nothing in it", () => {
    expect(summarizeSeason([], [])).toEqual({
      phase: "planning",
      episodeCount: 0,
      doneCount: 0,
      sceneCount: 0,
      lineCount: 0,
      runtimeMinutes: null,
      lastEdited: null,
      continueSceneId: null,
    });
  });
});

describe("summarizeSeason after an import", () => {
  it("continues from the first scene when every scene has the same time", () => {
    const updatedAt = new Date("2026-01-01");
    const row = (id: string) => ({ ...scene({ updatedAt }), id, episodeId: "e1" });
    const stats = summarizeSeason([{ id: "e1", status: "drafting" }], [row("first"), row("second")]);
    expect(stats.continueSceneId).toBe("first");
  });
});
