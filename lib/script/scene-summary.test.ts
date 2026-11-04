import { describe, expect, it } from "vitest";
import type { Beat, BeatType } from "@/lib/db/schema";
import {
  formatTimecode,
  parseLocation,
  speakerLineCounts,
  summarizeBeats,
} from "./scene-summary";

const beat = (type: BeatType, text: string, character?: string): Beat => ({
  id: text,
  type,
  text,
  character,
});

describe("speakerLineCounts", () => {
  it("counts dialogue and voice-over per speaker, ignoring case", () => {
    const counts = speakerLineCounts([
      beat("dialogue", "a", "Mira"),
      beat("vo", "b", "MIRA"),
      beat("dialogue", "c", "JUN"),
      beat("visual", "d"),
    ]);
    expect([...counts]).toEqual([
      ["MIRA", 2],
      ["JUN", 1],
    ]);
  });

  it("skips spoken lines with no character", () => {
    expect(speakerLineCounts([beat("vo", "a")]).size).toBe(0);
  });
});

describe("summarizeBeats", () => {
  it("counts spoken lines, including unattributed voice-over", () => {
    const beats = [beat("vo", "a"), beat("dialogue", "b", "JUN"), beat("sound", "c")];
    expect(summarizeBeats(beats).lineCount).toBe(2);
  });

  it("previews the first visual or dialogue beat, skipping everything else", () => {
    const beats = [
      beat("sound", "A bell"),
      beat("action", "She runs"),
      beat("dialogue", "Wait!", "MIRA"),
      beat("visual", "Fog"),
    ];
    expect(summarizeBeats(beats).preview).toBe("MIRA: Wait!");
  });

  it("uses a visual beat as plain text and skips blank ones", () => {
    const beats = [beat("visual", "   "), beat("visual", "Fog rolls in")];
    expect(summarizeBeats(beats).preview).toBe("Fog rolls in");
  });

  it("returns nothing for an empty scene", () => {
    expect(summarizeBeats([])).toEqual({ lineCount: 0, preview: null });
  });
});

describe("parseLocation", () => {
  it("splits the place from the time of day", () => {
    expect(parseLocation("HARBOUR WALL - NIGHT")).toEqual({
      place: "HARBOUR WALL",
      timeOfDay: { label: "NIGHT", period: "night" },
    });
    expect(parseLocation("City Streets – day").timeOfDay).toEqual({
      label: "DAY",
      period: "day",
    });
  });

  it("does not read a time of day out of a place name", () => {
    expect(parseLocation("NIGHT MARKET").timeOfDay).toBeNull();
    expect(parseLocation("DAY CARE").place).toBe("DAY CARE");
  });

  it("keeps the whole text when the ending is not a time", () => {
    expect(parseLocation("ROOFTOP - CONTINUOUS")).toEqual({
      place: "ROOFTOP - CONTINUOUS",
      timeOfDay: null,
    });
  });

  it("handles a missing location", () => {
    expect(parseLocation(null)).toEqual({ place: null, timeOfDay: null });
  });
});

describe("formatTimecode", () => {
  it("uses an en dash", () => {
    expect(formatTimecode("2:00 - 6:00")).toBe("2:00 – 6:00");
    expect(formatTimecode("9:00-12:30")).toBe("9:00 – 12:30");
  });

  it("leaves a single time alone", () => {
    expect(formatTimecode("21:00")).toBe("21:00");
  });
});
