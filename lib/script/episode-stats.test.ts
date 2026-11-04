import { describe, expect, it } from "vitest";
import { summarizeEpisode, type EpisodeSceneRow } from "./episode-stats";

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
