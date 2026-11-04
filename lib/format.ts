export type SceneKind = "prologue" | "scene" | "outro" | "post_credit";

export const SCENE_KIND_LABELS: Record<SceneKind, string> = {
  prologue: "Prologue",
  scene: "Scene",
  outro: "Episode Outro",
  post_credit: "Post-Credit Scene",
};

export function sceneTitle(scene: { kind: SceneKind; title: string | null }) {
  return scene.title ?? SCENE_KIND_LABELS[scene.kind];
}

export function seasonTitle(season: { number: number; title: string | null }) {
  const label = `Season ${season.number}`;
  return season.title ? `${label}: ${season.title}` : label;
}

export function plural(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

export function formatRuntime(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `~${rest}m`;
  return rest === 0 ? `~${hours}h` : `~${hours}h ${rest}m`;
}

const relativeFormat = new Intl.RelativeTimeFormat("en");

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 60 * 60],
  ["month", 30 * 24 * 60 * 60],
  ["week", 7 * 24 * 60 * 60],
  ["day", 24 * 60 * 60],
  ["hour", 60 * 60],
  ["minute", 60],
];

export function formatRelative(date: Date, now: Date) {
  const seconds = (now.getTime() - date.getTime()) / 1000;

  for (const [unit, size] of UNITS) {
    if (seconds >= size) {
      return relativeFormat.format(-Math.floor(seconds / size), unit);
    }
  }
  return "just now";
}
