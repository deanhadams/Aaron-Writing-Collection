import { describe, expect, it } from "vitest";
import { formatRelative, formatRuntime, displayTitle, formatRelativeShort } from "./format";

const now = new Date("2026-06-15T12:00:00Z");
const ago = (seconds: number) => new Date(now.getTime() - seconds * 1000);

describe("formatRuntime", () => {
  it.each([
    [45, "~45m"],
    [60, "~1h"],
    [500, "~8h 20m"],
  ])("formats %i minutes", (minutes, expected) => {
    expect(formatRuntime(minutes)).toBe(expected);
  });
});

describe("displayTitle", () => {
  it.each([
    ["NO HELL", "No Hell"],
    ["THE ASH FORCE", "The Ash Force"],
    ["ENCOUNTER", "Encounter"],
    ["STRONG AMONG THE WEAK", "Strong Among the Weak"],
    ["THE WARRIOR'S DEPARTMENTS", "The Warrior's Departments"],
    ["LET’S ROAR! SLAYERS VS. WARRIORS", "Let’s Roar! Slayers vs. Warriors"],
    ["SHARP CLAWS VS. SOFT PAWS", "Sharp Claws vs. Soft Paws"],
    ["CURSE OF THE HORNS", "Curse of the Horns"],
    ["WHAT YOU DESIRE/CONNECT TO MOST", "What You Desire/Connect to Most"],
    ["HELL NO (SEASON FINALE)", "Hell No (Season Finale)"],
    ["THE BIG FIVE (Part 1)", "The Big Five (Part 1)"],
    ["DEPT ZERO", "Dept Zero"],
  ])("reads %s as %s", (title, expected) => {
    expect(displayTitle(title)).toBe(expected);
  });

  it("keeps dotted initials", () => {
    expect(displayTitle("THE LEGEND OF S.H.A.D.O.W.")).toBe("The Legend of S.H.A.D.O.W.");
    expect(displayTitle("S.H.A.D.O.W. RISES")).toBe("S.H.A.D.O.W. Rises");
  });

  it("keeps roman numerals", () => {
    expect(displayTitle("THE BIG FIVE PART II")).toBe("The Big Five Part II");
  });

  it("capitalizes small words at the start, at the end and in brackets", () => {
    expect(displayTitle("A WAY IN")).toBe("A Way In");
    expect(displayTitle("THE END (OF DAYS)")).toBe("The End (Of Days)");
  });

  it("leaves a title with any lower case as typed", () => {
    expect(displayTitle("The NASA Job")).toBe("The NASA Job");
    expect(displayTitle("iPhone story")).toBe("iPhone story");
    expect(displayTitle("HELL no")).toBe("HELL no");
  });

  it("leaves titles with no letters alone", () => {
    expect(displayTitle("2001")).toBe("2001");
    expect(displayTitle("")).toBe("");
  });

  it("works on accented capitals", () => {
    expect(displayTitle("ÉTÉ SANS FIN")).toBe("Été Sans Fin");
  });
});

describe("formatRelativeShort", () => {
  const now = new Date("2026-06-15T12:00:00Z");
  const ago = (seconds: number) => new Date(now.getTime() - seconds * 1000);

  it.each([
    [30, "just now"],
    [5 * 60, "5m ago"],
    [6 * 60 * 60, "6h ago"],
    [3 * 24 * 60 * 60, "3d ago"],
    [14 * 24 * 60 * 60, "2w ago"],
    [60 * 24 * 60 * 60, "2mo ago"],
    [400 * 24 * 60 * 60, "1y ago"],
  ])("shows %i seconds as %s", (seconds, expected) => {
    expect(formatRelativeShort(ago(seconds), now)).toBe(expected);
  });
});

describe("formatRelative", () => {
  it.each([
    [10, "just now"],
    [5 * 60, "5 minutes ago"],
    [60 * 60, "1 hour ago"],
    [3 * 60 * 60, "3 hours ago"],
    [2 * 24 * 60 * 60, "2 days ago"],
    [14 * 24 * 60 * 60, "2 weeks ago"],
    [62 * 24 * 60 * 60, "2 months ago"],
    [800 * 24 * 60 * 60, "2 years ago"],
  ])("formats %i seconds ago", (seconds, expected) => {
    expect(formatRelative(ago(seconds), now)).toBe(expected);
  });

  it("treats a slightly future date as now", () => {
    expect(formatRelative(ago(-30), now)).toBe("just now");
  });
});
