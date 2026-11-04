import { describe, expect, it } from "vitest";
import { formatRelative } from "./format";

const now = new Date("2026-06-15T12:00:00Z");
const ago = (seconds: number) => new Date(now.getTime() - seconds * 1000);

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
