import { BEAT_TYPES, type Beat, type BeatType } from "@/lib/db/schema";
import { hasSpeaker } from "@/lib/script/beat-fields";
import type { SceneFields } from "@/lib/scenes/validate";

export type HeaderField = "title" | "timecode" | "location";

const COALESCE_MS = 800;
const HISTORY_LIMIT = 200;

export const TYPE_CYCLE: BeatType[] = [...BEAT_TYPES];

export function nextType(type: BeatType, step: 1 | -1) {
  const count = TYPE_CYCLE.length;
  return TYPE_CYCLE[(TYPE_CYCLE.indexOf(type) + step + count) % count];
}

// crypto.randomUUID only exists on https and localhost.
export function newBeatId() {
  return globalThis.crypto?.randomUUID?.() ?? `beat-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createBeat(type: BeatType, character?: string): Beat {
  return { id: newBeatId(), type, ...(character && { character }), text: "" };
}

const sameIds = (a: string[], b: string[]) =>
  a.length === b.length && a.every((id, index) => id === b[index]);

/**
 * Editor state outside React. Rows subscribe to their own beat, so a keystroke
 * re-renders one row rather than the whole list.
 */
export function createEditorStore(initial: SceneFields) {
  let doc = initial;
  let order = doc.beats.map(({ id }) => id);
  let byId = new Map(doc.beats.map((beat) => [beat.id, beat]));
  let past: SceneFields[] = [];
  let future: SceneFields[] = [];
  let lastKey: string | null = null;
  let lastAt = 0;
  const listeners = new Set<() => void>();
  const changeListeners = new Set<() => void>();

  const show = (next: SceneFields) => {
    doc = next;
    byId = new Map(next.beats.map((beat) => [beat.id, beat]));
    const ids = next.beats.map(({ id }) => id);
    if (!sameIds(ids, order)) order = ids;
    listeners.forEach((listener) => listener());
  };

  const changed = () => changeListeners.forEach((listener) => listener());

  /** Typing under the same key within a moment undoes as one step. */
  const commit = (next: SceneFields, key: string | null = null) => {
    const now = Date.now();
    const isSameRun = key !== null && key === lastKey && now - lastAt < COALESCE_MS;

    if (!isSameRun) {
      past = [...past.slice(-(HISTORY_LIMIT - 1)), doc];
    }
    future = [];
    lastKey = key;
    lastAt = now;
    show(next);
    changed();
  };

  const setBeats = (beats: Beat[], key: string | null = null) => commit({ ...doc, beats }, key);

  const indexOf = (id: string) => doc.beats.findIndex((beat) => beat.id === id);

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    /** Called for edits only, never for a reload from the server. */
    onChange(listener: () => void) {
      changeListeners.add(listener);
      return () => changeListeners.delete(listener);
    },

    getDoc: () => doc,
    getOrder: () => order,
    getBeat: (id: string) => byId.get(id),
    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,

    updateBeat(id: string, patch: Partial<Beat>, key?: string) {
      setBeats(doc.beats.map((beat) => (beat.id === id ? { ...beat, ...patch } : beat)), key ?? null);
    },

    setHeader(field: HeaderField, value: string) {
      commit({ ...doc, [field]: value }, `header:${field}`);
    },

    /** Adds after the given beat, or at the top when there is none. */
    insertAfter(id: string | null, beat: Beat) {
      const at = id === null ? 0 : indexOf(id) + 1;
      setBeats([...doc.beats.slice(0, at), beat, ...doc.beats.slice(at)]);
    },

    /** Splits at the caret: the rest of the text moves into a new beat. */
    splitBeat(id: string, caret: number, next: Beat) {
      const at = indexOf(id);
      const beat = doc.beats[at];
      if (!beat) return;

      setBeats([
        ...doc.beats.slice(0, at),
        { ...beat, text: beat.text.slice(0, caret) },
        { ...next, text: beat.text.slice(caret) },
        ...doc.beats.slice(at + 1),
      ]);
    },

    removeBeat(id: string) {
      const index = indexOf(id);
      if (index < 0) return null;

      const beat = doc.beats[index];
      setBeats(doc.beats.filter((item) => item.id !== id));
      return { beat, index, previous: doc.beats[index - 1]?.id ?? doc.beats[0]?.id ?? null };
    },

    restoreBeat(beat: Beat, index: number) {
      if (byId.has(beat.id)) return;
      setBeats([...doc.beats.slice(0, index), beat, ...doc.beats.slice(index)]);
    },

    moveBeat(id: string, step: -1 | 1) {
      const from = indexOf(id);
      const to = from + step;
      if (from < 0 || to < 0 || to >= doc.beats.length) return;

      const beats = [...doc.beats];
      [beats[from], beats[to]] = [beats[to], beats[from]];
      setBeats(beats);
    },

    moveBeatTo(id: string, overId: string) {
      const from = indexOf(id);
      const to = indexOf(overId);
      if (from < 0 || to < 0 || from === to) return;

      const beats = [...doc.beats];
      const [moved] = beats.splice(from, 1);
      beats.splice(to, 0, moved);
      setBeats(beats);
    },

    setType(id: string, type: BeatType, patch: Partial<Beat> = {}) {
      this.updateBeat(id, { type, ...patch });
    },

    undo() {
      const previous = past.at(-1);
      if (!previous) return false;

      past = past.slice(0, -1);
      future = [doc, ...future];
      lastKey = null;
      show(previous);
      changed();
      return true;
    },

    redo() {
      const [next, ...rest] = future;
      if (!next) return false;

      future = rest;
      past = [...past, doc];
      lastKey = null;
      show(next);
      changed();
      return true;
    },

    /** Takes a version from the server. It is not an edit, so nothing autosaves. */
    replace(next: SceneFields) {
      past = [];
      future = [];
      lastKey = null;
      show(next);
    },
  };
}

export type EditorStore = ReturnType<typeof createEditorStore>;

export function speakerFor(beat: Beat) {
  return hasSpeaker(beat.type) ? beat.character : undefined;
}

export function countWords(beats: Beat[]) {
  return beats.reduce((total, { text }) => total + (text.match(/\S+/g)?.length ?? 0), 0);
}
