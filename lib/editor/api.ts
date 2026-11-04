import type { Beat } from "@/lib/db/schema";
import { normalizeBeat } from "@/lib/script/beat-fields";
import type { SceneFields } from "@/lib/scenes/validate";
import type { SendResult } from "./save-queue";

const jsonRequest = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export async function sendScene(sceneId: string, doc: SceneFields, version: number): Promise<SendResult> {
  const response = await fetch(
    `/api/scenes/${sceneId}`,
    jsonRequest("PUT", { ...doc, beats: doc.beats.map(normalizeBeat), version }),
  );

  // Gone means someone deleted the scene, so stop saving and say so.
  if (response.status === 409 || response.status === 404) return { kind: "conflict" };
  if (response.status === 401) return { kind: "unauthorized" };
  if (!response.ok) return { kind: "failed" };

  const { version: saved } = (await response.json()) as { version: number };
  return { kind: "saved", version: saved };
}

export type LatestScene = SceneFields & { version: number };

export async function fetchScene(sceneId: string): Promise<LatestScene | "deleted" | null> {
  const response = await fetch(`/api/scenes/${sceneId}`, { cache: "no-store" });
  if (response.status === 404) return "deleted";
  return response.ok ? ((await response.json()) as LatestScene) : null;
}

export type Revision = {
  id: string;
  title: string | null;
  timecode: string | null;
  location: string | null;
  sealed: boolean;
  savedAt: string;
  savedBy: string | null;
  beatCount: number;
  preview: Beat[];
};

export async function fetchRevisions(sceneId: string): Promise<Revision[]> {
  const response = await fetch(`/api/scenes/${sceneId}/revisions`, { cache: "no-store" });
  if (!response.ok) throw new Error("Could not load history");
  return (await response.json()) as Revision[];
}

export type RestoreResult =
  | ({ kind: "saved"; version: number } & SceneFields)
  | { kind: "conflict" }
  | { kind: "failed" };

export async function restoreVersion(
  sceneId: string,
  revisionId: string,
  version: number,
): Promise<RestoreResult> {
  const response = await fetch(
    `/api/scenes/${sceneId}/revisions`,
    jsonRequest("POST", { revisionId, version }),
  ).catch(() => null);

  if (response?.status === 409) return { kind: "conflict" };
  if (!response?.ok) return { kind: "failed" };

  const { version: saved, title, timecode, location, beats } = (await response.json()) as SceneFields & {
    version: number;
  };
  return { kind: "saved", version: saved, title, timecode, location, beats };
}

export async function sendHeartbeat(sceneId: string) {
  const response = await fetch(`/api/scenes/${sceneId}/presence`, { method: "POST" });
  if (!response.ok) return [];
  return ((await response.json()) as { others: string[] }).others;
}

export function sendGoodbye(sceneId: string) {
  void fetch(`/api/scenes/${sceneId}/presence`, { method: "DELETE", keepalive: true }).catch(() => {});
}
