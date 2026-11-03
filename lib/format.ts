type SceneKind = "prologue" | "scene" | "outro" | "post_credit";

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

const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" });

export function formatDate(date: Date) {
  return dateFormat.format(date);
}
