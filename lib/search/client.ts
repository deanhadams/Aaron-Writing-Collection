import type { CharacterResult, EpisodeResult, LoreResult, SceneResult } from "./run";

/** Everything here is per browser, by design: recent searches stay on the device. */

const RECENT_KEY = "recent-searches";
const VIEW_KEY = "scene-view";
const MAX_RECENT = 6;

export function loadRecent(): string[] {
  try {
    const saved = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(saved) ? saved.filter((item): item is string => typeof item === "string").slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

export function addRecent(query: string) {
  const text = query.trim();
  if (!text) return;
  localStorage.setItem(RECENT_KEY, JSON.stringify([text, ...loadRecent().filter((item) => item !== text)].slice(0, MAX_RECENT)));
}

export const clearRecent = () => localStorage.removeItem(RECENT_KEY);

export type SceneView = "reader" | "scene" | "edit";

export const rememberView = (view: SceneView) => localStorage.setItem(VIEW_KEY, view);

export function lastView(): SceneView {
  const saved = typeof localStorage === "undefined" ? null : localStorage.getItem(VIEW_KEY);
  return saved === "reader" || saved === "edit" ? saved : "scene";
}

type SceneTarget = Pick<SceneResult, "id" | "episodeId" | "seasonId"> & { beatId?: string };

/** Opens a result where the person last was, at the exact line. */
export function sceneHref({ id, episodeId, seasonId, beatId }: SceneTarget, view: SceneView = lastView()) {
  const hash = beatId ? `#beat-${beatId}` : "";
  return view === "reader" ? `/read/${seasonId}/${episodeId}${hash || `#scene-${id}`}` : `/scenes/${id}${hash}`;
}

export type SearchResponse = {
  jump: { id: string; number: number; title: string } | null;
  scenes: { total: number; results: SceneResult[] };
  episodes: { total: number; results: EpisodeResult[] };
  characters: { total: number; results: CharacterResult[] };
  lore: { total: number; results: LoreResult[] };
};

export async function fetchSearch(query: string, signal: AbortSignal): Promise<SearchResponse | null> {
  const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=4`, { signal, cache: "no-store" });
  return response.ok ? ((await response.json()) as SearchResponse) : null;
}

export type QuickAction = { id: string; label: string; href: string; keywords: string };

const ACTIONS: QuickAction[] = [
  { id: "new-lore", label: "New lore entry", href: "/lore?new=1", keywords: "new lore entry create add" },
  { id: "characters", label: "Characters", href: "/characters", keywords: "characters cast cards people" },
  { id: "lore", label: "Lore", href: "/lore", keywords: "lore world bible entries" },
  { id: "library", label: "Library", href: "/", keywords: "library home seasons episodes" },
];

/** All of them with nothing typed, then only those the words fit. */
export function quickActions(query: string) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return ACTIONS.filter(({ keywords }) => words.every((word) => keywords.split(" ").some((key) => key.startsWith(word))));
}

export const EXAMPLE_SEARCHES = ["Desruc", '"air force"', "speaker:Revoc", "Colosseum -exam", "kind:post-credit"];

/** The filters on the results page, added to what was typed. */
export function composeQuery({ q, speaker, kind, from, to }: { q?: string; speaker?: string; kind?: string; from?: string; to?: string }) {
  const range = from || to ? `ep:${from || to}-${to || from}` : null;
  return [q?.trim(), speaker?.trim() && `speaker:"${speaker.trim().replace(/"/g, "")}"`, kind && `kind:${kind}`, range]
    .filter(Boolean)
    .join(" ");
}
