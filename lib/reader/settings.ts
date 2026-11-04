export const TEXT_SIZES = [
  { value: "small", label: "Small", rem: 0.9375 },
  { value: "medium", label: "Medium", rem: 1.0625 },
  { value: "large", label: "Large", rem: 1.25 },
  { value: "huge", label: "Huge", rem: 1.5 },
] as const;

export const LINE_SPACINGS = [
  { value: "tight", label: "Tight", ratio: 1.45 },
  { value: "normal", label: "Normal", ratio: 1.7 },
  { value: "relaxed", label: "Relaxed", ratio: 2 },
] as const;

export type ReaderSettings = {
  size: (typeof TEXT_SIZES)[number]["value"];
  spacing: (typeof LINE_SPACINGS)[number]["value"];
  colors: boolean;
  timecodes: boolean;
};

export const DEFAULT_SETTINGS: ReaderSettings = { size: "medium", spacing: "normal", colors: true, timecodes: true };

const STORAGE_KEY = "reader-settings";

/** Whatever localStorage holds, kept only where it is still a valid choice. */
export function parseSettings(raw: string | null): ReaderSettings {
  let saved: Partial<ReaderSettings> = {};
  try {
    saved = raw ? JSON.parse(raw) : {};
  } catch {
    // A corrupt value simply falls back to the defaults.
  }

  return {
    size: TEXT_SIZES.some(({ value }) => value === saved?.size) ? saved.size! : DEFAULT_SETTINGS.size,
    spacing: LINE_SPACINGS.some(({ value }) => value === saved?.spacing) ? saved.spacing! : DEFAULT_SETTINGS.spacing,
    colors: typeof saved?.colors === "boolean" ? saved.colors : DEFAULT_SETTINGS.colors,
    timecodes: typeof saved?.timecodes === "boolean" ? saved.timecodes : DEFAULT_SETTINGS.timecodes,
  };
}

export function readerVariables({ size, spacing }: ReaderSettings) {
  return {
    "--rd-size": `${TEXT_SIZES.find(({ value }) => value === size)?.rem}rem`,
    "--rd-leading": String(LINE_SPACINGS.find(({ value }) => value === spacing)?.ratio),
  };
}

let current: ReaderSettings | null = null;
const listeners = new Set<() => void>();

export const settingsStore = {
  get() {
    current ??= parseSettings(localStorage.getItem(STORAGE_KEY));
    return current;
  },
  server: () => DEFAULT_SETTINGS,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => void listeners.delete(listener);
  },
  update(change: Partial<ReaderSettings>) {
    current = { ...settingsStore.get(), ...change };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    listeners.forEach((listener) => listener());
  },
};
