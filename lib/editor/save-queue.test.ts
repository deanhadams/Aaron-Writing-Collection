import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AUTOSAVE_MS, createSaveQueue, type SendResult } from "./save-queue";

const doc = { title: null, timecode: null, location: null, beats: [] };

function setup(version = 1) {
  const send = vi.fn(async (_doc: unknown, sent: number): Promise<SendResult> => ({ kind: "saved", version: sent + 1 }));
  return { send, queue: createSaveQueue({ getDoc: () => doc, send, version }) };
}

const tick = (ms = 0) => vi.advanceTimersByTimeAsync(ms);

describe("createSaveQueue", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("saves once, two seconds after the last change", async () => {
    const { queue, send } = setup();
    queue.change();
    await tick(1500);
    queue.change();
    await tick(1500);
    expect(send).not.toHaveBeenCalled();
    expect(queue.getStatus()).toBe("saving");

    await tick(500);
    expect(send).toHaveBeenCalledTimes(1);
    expect(queue.getStatus()).toBe("saved");
    expect(queue.isDirty()).toBe(false);
  });

  it("sends the new version on the next save", async () => {
    const { queue, send } = setup(5);
    queue.change();
    await tick(AUTOSAVE_MS);
    queue.change();
    await tick(AUTOSAVE_MS);
    expect(send.mock.calls.map(([, version]) => version)).toEqual([5, 6]);
  });

  it("saves again when something changed during a save", async () => {
    const { queue, send } = setup();
    let finish: (result: SendResult) => void = () => {};
    send.mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)));

    queue.change();
    await tick(AUTOSAVE_MS);
    queue.change();
    finish({ kind: "saved", version: 2 });
    await tick(0);
    expect(queue.isDirty()).toBe(true);

    await tick(AUTOSAVE_MS);
    expect(send).toHaveBeenCalledTimes(2);
    expect(queue.isDirty()).toBe(false);
  });

  it("stays dirty and retries with growing gaps while offline", async () => {
    const { queue, send } = setup();
    send.mockRejectedValueOnce(new Error("offline"));
    send.mockRejectedValueOnce(new Error("offline"));

    queue.change();
    await tick(AUTOSAVE_MS);
    expect(queue.getStatus()).toBe("offline");
    expect(queue.isDirty()).toBe(true);

    await tick(AUTOSAVE_MS);
    expect(send).toHaveBeenCalledTimes(2);
    await tick(AUTOSAVE_MS * 2);
    expect(send).toHaveBeenCalledTimes(3);
    expect(queue.getStatus()).toBe("saved");
  });

  it("keeps offline showing through typing, then saves on reconnect", async () => {
    const { queue, send } = setup();
    send.mockRejectedValueOnce(new Error("offline"));
    queue.change();
    await tick(AUTOSAVE_MS);

    queue.change();
    expect(queue.getStatus()).toBe("offline");

    queue.retry();
    await tick(0);
    expect(queue.getStatus()).toBe("saved");
  });

  it("stops at a conflict and sends nothing more, however much is typed", async () => {
    const { queue, send } = setup();
    send.mockResolvedValueOnce({ kind: "conflict" });

    queue.change();
    await tick(AUTOSAVE_MS);
    expect(queue.getStatus()).toBe("conflict");

    queue.change();
    await tick(AUTOSAVE_MS * 10);
    await queue.flush();
    expect(send).toHaveBeenCalledTimes(1);
    expect(queue.isDirty()).toBe(true);
  });

  it("starts again from a reloaded version", async () => {
    const { queue, send } = setup();
    send.mockResolvedValueOnce({ kind: "conflict" });
    queue.change();
    await tick(AUTOSAVE_MS);

    queue.adopt(9);
    expect(queue.getStatus()).toBe("saved");
    expect(queue.isDirty()).toBe(false);

    queue.change();
    await tick(AUTOSAVE_MS);
    expect(send).toHaveBeenLastCalledWith(doc, 9);
  });

  it("flushes without waiting for the debounce", async () => {
    const { queue, send } = setup();
    queue.change();
    await expect(queue.flush()).resolves.toBe(true);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("shows signed out on a 401 and keeps the work", async () => {
    const { queue, send } = setup();
    send.mockResolvedValueOnce({ kind: "unauthorized" });
    queue.change();
    await tick(AUTOSAVE_MS);
    expect(queue.getStatus()).toBe("signed_out");
    expect(queue.isDirty()).toBe(true);
  });
});
