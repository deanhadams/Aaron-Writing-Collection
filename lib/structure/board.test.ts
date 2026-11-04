import { describe, expect, it } from "vitest";
import { createBoard, type Outcome } from "./board";

type Item = { id: string; label: string };

const items = (): Item[] => [
  { id: "a", label: "A" },
  { id: "b", label: "B" },
];

const reversed = (list: Item[]) => [...list].reverse();
const ids = (list: Item[]) => list.map(({ id }) => id);

function deferred<T>() {
  let resolve!: (value: Outcome<T>) => void;
  const promise = new Promise<Outcome<T>>((done) => (resolve = done));
  return { promise, resolve };
}

describe("board", () => {
  it("shows a change straight away, before the server answers", async () => {
    const board = createBoard({ items: items(), version: 1 });
    const answer = deferred<{ version: number }>();

    const running = board.run({ change: reversed, request: () => answer.promise });
    expect(ids(board.getItems())).toEqual(["b", "a"]);

    answer.resolve({ kind: "ok", data: { version: 2 } });
    await running;
    expect(ids(board.getItems())).toEqual(["b", "a"]);
  });

  it("takes the change back on a conflict", async () => {
    const board = createBoard({ items: items(), version: 1 });
    await board.run({ change: reversed, request: async () => ({ kind: "conflict" }) });
    expect(ids(board.getItems())).toEqual(["a", "b"]);
  });

  it("takes the change back when the network fails", async () => {
    const board = createBoard({ items: items(), version: 1 });
    const outcome = await board.run({ change: reversed, request: () => Promise.reject(new Error("offline")) });

    expect(outcome.kind).toBe("failed");
    expect(ids(board.getItems())).toEqual(["a", "b"]);
  });

  it("runs requests in order, each with the version before it returned", async () => {
    const board = createBoard({ items: items(), version: 1 });
    const seen: number[] = [];
    const op = () =>
      board.run({
        request: async ({ version }) => {
          seen.push(version);
          return { kind: "ok", data: { version: version + 1 } };
        },
        versionOf: ({ version }) => version,
      });

    await Promise.all([op(), op(), op()]);

    expect(seen).toEqual([1, 2, 3]);
    expect(board.getVersion()).toBe(4);
  });

  it("drops one refused change and keeps the one after it", async () => {
    const board = createBoard({ items: items(), version: 1 });
    const first = deferred<null>();
    const second = deferred<null>();
    const rename = (list: Item[]) => list.map((item) => (item.id === "a" ? { ...item, label: "Renamed" } : item));

    const one = board.run({ change: reversed, request: () => first.promise });
    const two = board.run({ change: rename, request: () => second.promise });

    first.resolve({ kind: "conflict" });
    await one;
    expect(ids(board.getItems())).toEqual(["a", "b"]);
    expect(board.getItems()[0].label).toBe("Renamed");

    second.resolve({ kind: "ok", data: null });
    await two;
    expect(board.getItems()[0].label).toBe("Renamed");
  });

  it("folds server data into the list", async () => {
    const board = createBoard({ items: items(), version: 1 });
    await board.run({
      request: async () => ({ kind: "ok", data: { label: "From the server" } }),
      settle: (list, { label }) => list.map((item) => (item.id === "b" ? { ...item, label } : item)),
    });
    expect(board.getItems()[1].label).toBe("From the server");
  });

  it("reads an item's latest confirmed state when its request runs", async () => {
    const board = createBoard({ items: items(), version: 1 });
    let seen: string | undefined;

    await board.run({
      request: async () => ({ kind: "ok", data: null }),
      settle: (list) => list.map((item) => ({ ...item, label: "Newer" })),
    });
    await board.run({
      request: async ({ item }) => {
        seen = item("a")?.label;
        return { kind: "ok", data: null };
      },
    });

    expect(seen).toBe("Newer");
  });

  describe("adopt", () => {
    const fresh = (version: number) => ({ items: [{ id: "c", label: "C" }], version });

    it("takes in a fresh page", () => {
      const board = createBoard({ items: items(), version: 1 });
      board.adopt(fresh(2));
      expect(ids(board.getItems())).toEqual(["c"]);
      expect(board.getVersion()).toBe(2);
    });

    it("ignores a page older than the list", () => {
      const board = createBoard({ items: items(), version: 5 });
      board.adopt(fresh(4));
      expect(ids(board.getItems())).toEqual(["a", "b"]);
    });

    it("waits while a change is in flight", async () => {
      const board = createBoard({ items: items(), version: 1 });
      const answer = deferred<null>();
      const running = board.run({ change: reversed, request: () => answer.promise });

      board.adopt(fresh(2));
      expect(ids(board.getItems())).toEqual(["b", "a"]);

      answer.resolve({ kind: "ok", data: null });
      await running;
    });
  });

  it("tells subscribers about each change", async () => {
    const board = createBoard({ items: items(), version: 1 });
    let calls = 0;
    const stop = board.subscribe(() => calls++);

    await board.run({ change: reversed, request: async () => ({ kind: "ok", data: null }) });
    expect(calls).toBe(2);

    stop();
    board.adopt({ items: [], version: 9 });
    expect(calls).toBe(2);
  });
});
