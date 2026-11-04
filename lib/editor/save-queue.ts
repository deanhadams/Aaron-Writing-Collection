import type { SceneFields } from "@/lib/scenes/validate";

export type SaveStatus = "saved" | "saving" | "offline" | "signed_out" | "conflict";

export type SendResult =
  | { kind: "saved"; version: number }
  | { kind: "conflict" }
  | { kind: "unauthorized" }
  | { kind: "failed" };

export const AUTOSAVE_MS = 2000;
const MAX_RETRY_MS = 30_000;

/**
 * Debounced saves, one at a time, outside React. A route left by navigation
 * stays alive but hidden, so a save has to outlive the component that asked
 * for it. After a conflict nothing is sent until someone chooses what to do.
 */
export function createSaveQueue({
  getDoc,
  send,
  version: startVersion,
}: {
  getDoc: () => SceneFields;
  send: (doc: SceneFields, version: number) => Promise<SendResult>;
  version: number;
}) {
  let version = startVersion;
  let status: SaveStatus = "saved";
  let edits = 0;
  let savedEdits = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running: Promise<void> | null = null;
  let retryMs = AUTOSAVE_MS;
  const listeners = new Set<() => void>();

  const setStatus = (next: SaveStatus) => {
    if (next === status) return;
    status = next;
    listeners.forEach((listener) => listener());
  };

  const clearTimer = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };

  const isDirty = () => edits !== savedEdits;

  const arm = (ms: number) => {
    clearTimer();
    timer = setTimeout(run, ms);
  };

  async function attempt() {
    const sending = edits;
    setStatus("saving");

    const result = await send(getDoc(), version).catch((): SendResult => ({ kind: "failed" }));

    if (result.kind === "saved") {
      version = result.version;
      savedEdits = sending;
      retryMs = AUTOSAVE_MS;
      if (isDirty()) arm(AUTOSAVE_MS);
      else setStatus("saved");
    } else if (result.kind === "conflict") {
      clearTimer();
      setStatus("conflict");
    } else {
      setStatus(result.kind === "unauthorized" ? "signed_out" : "offline");
      arm(retryMs);
      retryMs = Math.min(retryMs * 2, MAX_RETRY_MS);
    }
  }

  function run(): Promise<void> {
    clearTimer();
    if (running) return running;
    if (status === "conflict" || !isDirty()) return Promise.resolve();

    running = attempt().finally(() => {
      running = null;
    });
    return running;
  }

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getStatus: () => status,
    getVersion: () => version,
    isDirty,

    change() {
      edits++;
      if (status === "conflict") return;
      if (status === "saved") setStatus("saving");
      if (status === "saving") arm(AUTOSAVE_MS);
    },

    /** Sends anything pending now, and resolves once it has been answered. */
    async flush() {
      if (running) await running;
      await run();
      return !isDirty();
    },

    /** Retries straight away, such as when the browser comes back online. */
    retry() {
      if (status === "offline" || status === "signed_out") {
        retryMs = AUTOSAVE_MS;
        void run();
      }
    },

    markConflict() {
      clearTimer();
      setStatus("conflict");
    },

    /** Takes on a version from the server, leaving nothing to save. */
    adopt(next: number) {
      clearTimer();
      version = next;
      savedEdits = edits;
      retryMs = AUTOSAVE_MS;
      setStatus("saved");
    },
  };
}

export type SaveQueue = ReturnType<typeof createSaveQueue>;
