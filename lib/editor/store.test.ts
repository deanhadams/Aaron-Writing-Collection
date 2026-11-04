import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Beat } from "@/lib/db/schema";
import { countWords, createBeat, createEditorStore, nextType } from "./store";

const beat = (id: string, text = id): Beat => ({ id, type: "note", text });
const make = (...ids: string[]) =>
  createEditorStore({ title: "T", timecode: null, location: null, beats: ids.map((id) => beat(id)) });
const ids = (store: ReturnType<typeof make>) => store.getOrder().join();

describe("createEditorStore", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("keeps the same order array while typing, so the list does not re-render", () => {
    const store = make("a", "b");
    const before = store.getOrder();
    const other = store.getBeat("b");

    store.updateBeat("a", { text: "changed" });

    expect(store.getOrder()).toBe(before);
    expect(store.getBeat("b")).toBe(other);
  });

  it("inserts, splits and removes", () => {
    const store = make("a", "b");
    store.insertAfter("a", beat("c"));
    expect(ids(store)).toBe("a,c,b");

    store.insertAfter(null, beat("d"));
    expect(ids(store)).toBe("d,a,c,b");

    store.updateBeat("a", { text: "hello world" });
    store.splitBeat("a", 5, beat("e", ""));
    expect(store.getBeat("a")?.text).toBe("hello");
    expect(store.getBeat("e")?.text).toBe(" world");

    expect(store.removeBeat("c")).toMatchObject({ index: 3, previous: "e" });
    expect(ids(store)).toBe("d,a,e,b");
  });

  it("moves beats and stops at the ends", () => {
    const store = make("a", "b", "c");
    store.moveBeat("a", -1);
    expect(ids(store)).toBe("a,b,c");

    store.moveBeat("a", 1);
    expect(ids(store)).toBe("b,a,c");

    store.moveBeatTo("c", "b");
    expect(ids(store)).toBe("c,b,a");
  });

  it("restores a deleted beat to its place", () => {
    const store = make("a", "b", "c");
    const removed = store.removeBeat("b")!;
    store.restoreBeat(removed.beat, removed.index);
    expect(ids(store)).toBe("a,b,c");
  });

  it("undoes a burst of typing as one step, and a later pause as another", () => {
    const store = make("a");
    store.updateBeat("a", { text: "h" }, "text:a");
    vi.advanceTimersByTime(200);
    store.updateBeat("a", { text: "hi" }, "text:a");
    vi.advanceTimersByTime(2000);
    store.updateBeat("a", { text: "hi there" }, "text:a");

    store.undo();
    expect(store.getBeat("a")?.text).toBe("hi");
    store.undo();
    expect(store.getBeat("a")?.text).toBe("a");
    store.redo();
    store.redo();
    expect(store.getBeat("a")?.text).toBe("hi there");
  });

  it("undoes header edits and structure changes", () => {
    const store = make("a");
    store.setHeader("title", "New");
    store.insertAfter("a", beat("b"));

    store.undo();
    expect(ids(store)).toBe("a");
    store.undo();
    expect(store.getDoc().title).toBe("T");
    expect(store.undo()).toBe(false);
  });

  it("clears redo after a new edit", () => {
    const store = make("a");
    store.updateBeat("a", { text: "x" });
    store.undo();
    store.updateBeat("a", { text: "y" });
    expect(store.redo()).toBe(false);
  });

  it("does not report a reload from the server as an edit", () => {
    const store = make("a");
    const changed = vi.fn();
    store.onChange(changed);

    store.replace({ title: null, timecode: null, location: null, beats: [beat("z")] });

    expect(changed).not.toHaveBeenCalled();
    expect(ids(store)).toBe("z");
    expect(store.canUndo()).toBe(false);
  });
});

describe("helpers", () => {
  it("cycles types both ways and wraps", () => {
    expect(nextType("dialogue", 1)).toBe("visual");
    expect(nextType("dialogue", -1)).toBe("note");
    expect(nextType("note", 1)).toBe("dialogue");
  });

  it("makes beats with unique ids", () => {
    expect(createBeat("note").id).not.toBe(createBeat("note").id);
  });

  it("counts words", () => {
    expect(countWords([beat("a", "one two"), beat("b", "  three\nfour "), beat("c", "")])).toBe(4);
  });
});
