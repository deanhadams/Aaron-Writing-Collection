import { describe, expect, it } from "vitest";
import { firstUnfinished, moveItem, nextNumber, renumber, sameMembers } from "./order";
import { daysLeft } from "./result";

const episode = (id: string, number: number) => ({ id, number });

describe("renumber", () => {
  it("gives the numbers out again in the new order", () => {
    const items = [episode("a", 1), episode("b", 2), episode("c", 3)];
    expect(renumber(items, ["c", "a", "b"])).toEqual([episode("c", 1), episode("a", 2), episode("b", 3)]);
  });

  it("keeps gaps in the numbering where they were", () => {
    const items = [episode("a", 1), episode("b", 2), episode("c", 5)];
    expect(renumber(items, ["c", "b", "a"]).map(({ number }) => number)).toEqual([1, 2, 5]);
  });

  it("copes with a list that is not in number order", () => {
    const items = [episode("b", 4), episode("a", 2)];
    expect(renumber(items, ["a", "b"])).toEqual([episode("a", 2), episode("b", 4)]);
  });
});

describe("moveItem", () => {
  it("moves up and down", () => {
    expect(moveItem(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
    expect(moveItem(["a", "b", "c"], 0, 1)).toEqual(["b", "a", "c"]);
  });
});

describe("sameMembers", () => {
  it("is true for the same ids in any order", () => {
    expect(sameMembers(["a", "b"], ["b", "a"])).toBe(true);
  });

  it("refuses a missing id, an extra id or a repeat", () => {
    expect(sameMembers(["a", "b"], ["a"])).toBe(false);
    expect(sameMembers(["a"], ["a", "b"])).toBe(false);
    expect(sameMembers(["a", "b"], ["a", "a"])).toBe(false);
  });
});

describe("nextNumber", () => {
  it("follows the highest number, and starts at 1", () => {
    expect(nextNumber([1, 2, 5])).toBe(6);
    expect(nextNumber([])).toBe(1);
  });
});

describe("firstUnfinished", () => {
  it("finds the first episode not done", () => {
    const episodes = [{ status: "done" as const }, { status: "idea" as const }, { status: "drafting" as const }];
    expect(firstUnfinished(episodes)).toBe(episodes[1]);
  });

  it("is null when everything is done", () => {
    expect(firstUnfinished([{ status: "done" as const }])).toBeNull();
  });
});

describe("daysLeft", () => {
  const day = 24 * 60 * 60 * 1000;

  it("counts down from 30", () => {
    const deleted = new Date("2026-01-01");
    expect(daysLeft(deleted, deleted)).toBe(30);
    expect(daysLeft(deleted, new Date(deleted.getTime() + 10 * day))).toBe(20);
  });

  it("never shows zero for something still listed", () => {
    const deleted = new Date("2026-01-01");
    expect(daysLeft(deleted, new Date(deleted.getTime() + 29.9 * day))).toBe(1);
  });
});
