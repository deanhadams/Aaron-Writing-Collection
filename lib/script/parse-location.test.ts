import { describe, expect, it } from "vitest";
import { parseLocation } from "./parse-location";

describe("parseLocation", () => {
  it("parses HARBOUR WALL - NIGHT", () => {
    expect(parseLocation("HARBOUR WALL - NIGHT")).toEqual({
      place: "Harbour Wall",
      timeOfDay: { label: "NIGHT", tone: "night" },
      original: "HARBOUR WALL - NIGHT",
    });
  });

  it("parses CLASSROOM - DAY", () => {
    const { place, timeOfDay } = parseLocation("CLASSROOM - DAY");
    expect(place).toBe("Classroom");
    expect(timeOfDay).toEqual({ label: "DAY", tone: "day" });
  });

  it("parses CITY STREETS - DAY", () => {
    const { place, timeOfDay } = parseLocation("CITY STREETS - DAY");
    expect(place).toBe("City Streets");
    expect(timeOfDay?.tone).toBe("day");
  });

  it("parses APARTMENT & ORPHANAGE - NIGHT", () => {
    const { place, timeOfDay } = parseLocation("APARTMENT & ORPHANAGE - NIGHT");
    expect(place).toBe("Apartment & Orphanage");
    expect(timeOfDay?.tone).toBe("night");
  });

  it("parses ORPHANAGE - MORNING", () => {
    const { place, timeOfDay } = parseLocation("ORPHANAGE - MORNING");
    expect(place).toBe("Orphanage");
    expect(timeOfDay).toEqual({ label: "MORNING", tone: "morning" });
  });

  it("hides the time chip when the location has no time of day", () => {
    expect(parseLocation("ROOFTOP GARDEN")).toEqual({
      place: "Rooftop Garden",
      timeOfDay: null,
      original: "ROOFTOP GARDEN",
    });
  });

  it.each([null, undefined, "", "   "])("returns nothing for %j", (value) => {
    expect(parseLocation(value)).toEqual({
      place: null,
      timeOfDay: null,
      original: null,
    });
  });

  it.each([
    ["DAWN", "morning"],
    ["EVENING", "evening"],
    ["DUSK", "evening"],
    ["TWILIGHT", "evening"],
  ])("gives %s the %s tone", (word, tone) => {
    expect(parseLocation(`PIER - ${word}`).timeOfDay).toEqual({ label: word, tone });
  });

  it("ignores case and accepts any dash", () => {
    expect(parseLocation("city streets – day").timeOfDay?.label).toBe("DAY");
    expect(parseLocation("City Streets — Night").place).toBe("City Streets");
  });

  it.each([
    ["INT. CLASSROOM - DAY", "Classroom"],
    ["EXT. CITY STREETS - DAY", "City Streets"],
    ["int. classroom - day", "Classroom"],
    ["INT./EXT. CAR - DAY", "Car"],
    ["I/E CAR - DAY", "Car"],
  ])("removes the prefix from %s", (location, place) => {
    expect(parseLocation(location).place).toBe(place);
  });

  it("keeps the original text, prefix included, for the tooltip", () => {
    expect(parseLocation("  INT. CLASSROOM - DAY ").original).toBe(
      "INT. CLASSROOM - DAY",
    );
  });

  it("never reads a time of day out of a place name", () => {
    expect(parseLocation("NIGHT MARKET").timeOfDay).toBeNull();
    expect(parseLocation("DAY CARE").place).toBe("Day Care");
    expect(parseLocation("NIGHT MARKET - DAY")).toMatchObject({
      place: "Night Market",
      timeOfDay: { label: "DAY" },
    });
  });

  it("never shows the time word in the place", () => {
    expect(parseLocation("ROOFTOP - NIGHT - CONTINUOUS")).toMatchObject({
      place: "Rooftop",
      timeOfDay: { label: "NIGHT" },
    });
    expect(parseLocation("ROOFTOP - NIGHT (FLASHBACK)").timeOfDay?.label).toBe("NIGHT");
    expect(parseLocation("NIGHT")).toMatchObject({
      place: null,
      timeOfDay: { label: "NIGHT" },
    });
  });

  it("keeps extra place detail and an unknown ending", () => {
    expect(parseLocation("HOSPITAL - ROOM 3 - NIGHT").place).toBe("Hospital - Room 3");
    expect(parseLocation("ROOFTOP - CONTINUOUS")).toMatchObject({
      place: "Rooftop - Continuous",
      timeOfDay: null,
    });
  });

  it("title-cases names properly", () => {
    expect(parseLocation("HALL OF THE MOUNTAIN KING").place).toBe(
      "Hall of the Mountain King",
    );
    expect(parseLocation("THE AARON'S ROOM").place).toBe("The Aaron's Room");
    expect(parseLocation("SEMI-DETACHED HOUSE - DAY").place).toBe("Semi-Detached House");
  });
});
