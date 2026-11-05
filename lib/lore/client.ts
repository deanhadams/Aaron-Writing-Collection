import { sendToStorage } from "@/lib/characters/client";
import type { LoreDraft } from "@/lib/db/schema";
import type { SendResult } from "@/lib/editor/save-queue";

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
  keepalive: true,
});

async function errorOf(response: Response, fallback: string) {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? fallback;
}

export async function createLoreEntry(title: string, category: string) {
  const response = await fetch("/api/lore", json("POST", { title, category }));
  if (!response.ok) throw new Error(await errorOf(response, "Could not create the entry"));
  return (await response.json()) as { slug: string };
}

export async function sendEntry(id: string, draft: LoreDraft, version: number): Promise<SendResult> {
  const response = await fetch(`/api/lore/${id}`, json("PUT", { ...draft, version })).catch(() => null);

  if (!response) return { kind: "failed" };
  if (response.status === 409 || response.status === 404) return { kind: "conflict" };
  if (response.status === 401) return { kind: "unauthorized" };
  if (!response.ok) return { kind: "failed" };
  return { kind: "saved", version: ((await response.json()) as { version: number }).version };
}

export type LatestEntry = LoreDraft & { version: number };

export async function fetchEntry(id: string): Promise<LatestEntry | null> {
  const response = await fetch(`/api/lore/${id}`, { cache: "no-store" }).catch(() => null);
  return response?.ok ? ((await response.json()) as LatestEntry) : null;
}

export type LoreRevision = {
  id: string;
  content: LoreDraft;
  sealed: boolean;
  savedAt: string;
  savedBy: string | null;
};

export async function fetchRevisions(id: string): Promise<LoreRevision[]> {
  const response = await fetch(`/api/lore/${id}/revisions`, { cache: "no-store" });
  if (!response.ok) throw new Error("Could not load history");
  return (await response.json()) as LoreRevision[];
}

export async function restoreRevision(id: string, revisionId: string, version: number) {
  const response = await fetch(`/api/lore/${id}/revisions`, json("POST", { revisionId, version })).catch(() => null);
  if (response?.status === 409) return { kind: "conflict" as const };
  if (!response?.ok) return { kind: "failed" as const };
  return { kind: "saved" as const, ...((await response.json()) as { version: number; draft: LoreDraft }) };
}

export async function removeEntry(id: string, version: number) {
  const response = await fetch(`/api/lore/${id}`, json("DELETE", { version }));
  if (!response.ok) throw new Error(await errorOf(response, "Could not delete"));
}

export type DeletedEntry = { id: string; title: string; version: number; deletedAt: string; deletedBy: string | null };

export async function fetchDeletedEntries(): Promise<DeletedEntry[]> {
  const response = await fetch("/api/lore/deleted", { cache: "no-store" });
  return response.ok ? ((await response.json()) as DeletedEntry[]) : [];
}

export async function bringBackEntry(id: string, version: number) {
  const response = await fetch(`/api/lore/${id}/restore`, json("POST", { version }));
  if (!response.ok) throw new Error(await errorOf(response, "Could not restore"));
}

/** Straight to R2 through the same presign flow as character images. */
export const uploadLoreImage = (id: string, file: File, onProgress: (percent: number) => void) =>
  sendToStorage(`/api/lore/${id}/uploads`, { contentType: file.type, size: file.size }, file, onProgress);
