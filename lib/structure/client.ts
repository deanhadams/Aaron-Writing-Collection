import type { SceneKind } from "@/lib/format";
import type { Outcome } from "./board";
import type { EpisodePatch } from "./episode";

export type DeletedList = {
  episodes: {
    id: string;
    number: number;
    title: string;
    version: number;
    deletedAt: string;
    deletedBy: string | null;
    sceneCount: number;
  }[];
  scenes: {
    id: string;
    kind: SceneKind;
    title: string | null;
    version: number;
    deletedAt: string;
    deletedBy: string | null;
    episodeNumber: number;
    episodeTitle: string;
  }[];
};

async function send<T>(url: string, method: string, body: unknown): Promise<Outcome<T>> {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    // A reload straight after a change must not cancel it.
    keepalive: true,
  }).catch(() => null);

  if (!response) return { kind: "failed", message: "Could not reach the server" };
  if (response.status === 401) return { kind: "signed_out" };
  // Gone means someone else deleted it, which is a conflict to the person here.
  if (response.status === 409 || response.status === 404) return { kind: "conflict" };

  const data = await response.json().catch(() => null);
  return response.ok
    ? { kind: "ok", data: data as T }
    : { kind: "failed", message: data?.error ?? "Something went wrong" };
}

type Version = { version: number };

export const saveSeason = (seasonId: string, body: Version & { title: string | null; summary: string | null }) =>
  send<Version>(`/api/seasons/${seasonId}`, "PATCH", body);

export const newEpisode = (seasonId: string, body: Version & { number: number; title: string }) =>
  send<Version & { episode: { id: string; number: number; version: number } }>(
    `/api/seasons/${seasonId}/episodes`,
    "POST",
    body,
  );

export const sendEpisodeOrder = (seasonId: string, body: Version & { ids: string[] }) =>
  send<Version>(`/api/seasons/${seasonId}/episodes`, "PUT", body);

export const patchEpisode = (episodeId: string, body: Version & EpisodePatch) =>
  send<Version>(`/api/episodes/${episodeId}`, "PATCH", body);

export const removeEpisode = (episodeId: string, version: number) =>
  send<{ seasonVersion: number }>(`/api/episodes/${episodeId}`, "DELETE", { version });

export const bringBackEpisode = (episodeId: string, version: number) =>
  send<{ seasonVersion: number; number: number; renumbered: boolean }>(
    `/api/episodes/${episodeId}/restore`,
    "POST",
    { version },
  );

export const newScene = (
  episodeId: string,
  body: Version & { afterId: string | null; kind: SceneKind; title: string | null },
) => send<Version & { scene: Version & { id: string } }>(`/api/episodes/${episodeId}/scenes`, "POST", body);

export const sendSceneOrder = (episodeId: string, body: Version & { ids: string[] }) =>
  send<Version>(`/api/episodes/${episodeId}/scenes`, "PUT", body);

export const patchScene = (sceneId: string, body: Version & { title: string | null; kind: SceneKind }) =>
  send<Version>(`/api/scenes/${sceneId}/details`, "PATCH", body);

export const copyScene = (sceneId: string, version: number) =>
  send<Version & { scene: Version & { id: string; title: string | null } }>(
    `/api/scenes/${sceneId}/duplicate`,
    "POST",
    { version },
  );

export const relocateScene = (sceneId: string, targetEpisodeId: string, version: number) =>
  send<Version & { targetNumber: number }>(`/api/scenes/${sceneId}/move`, "POST", { version, targetEpisodeId });

export const removeScene = (sceneId: string, version: number) =>
  send<{ scenesVersion: number }>(`/api/scenes/${sceneId}`, "DELETE", { version });

export const bringBackScene = (sceneId: string, version: number) =>
  send<{ scenesVersion: number }>(`/api/scenes/${sceneId}/restore`, "POST", { version });

export async function fetchDeleted(seasonId: string): Promise<DeletedList | null> {
  const response = await fetch(`/api/seasons/${seasonId}/deleted`, { cache: "no-store" }).catch(() => null);
  return response?.ok ? ((await response.json()) as DeletedList) : null;
}
