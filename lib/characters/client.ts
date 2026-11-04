import type { UploadKind } from "./upload";
import type { CharacterFields } from "./validate";

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

async function errorText(response: Response, fallback: string) {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? fallback;
}

export async function createCard(name: string, fullName: string | null) {
  const response = await fetch("/api/characters", json("POST", { name, fullName }));
  if (!response.ok) throw new Error(await errorText(response, "Could not create the card"));
  return (await response.json()) as { slug: string };
}

export type SaveOutcome =
  | { kind: "saved"; version: number }
  | { kind: "conflict" }
  | { kind: "error"; message: string };

export async function saveCard(id: string, version: number, fields: CharacterFields): Promise<SaveOutcome> {
  const response = await fetch(`/api/characters/${id}`, json("PUT", { ...fields, version })).catch(() => null);

  if (!response) return { kind: "error", message: "Could not reach the server. Your text is still here." };
  if (response.status === 409) return { kind: "conflict" };
  if (!response.ok) return { kind: "error", message: await errorText(response, "Could not save") };
  return { kind: "saved", version: ((await response.json()) as { version: number }).version };
}

export async function mergeCard(id: string, targetId: string, version: number) {
  const response = await fetch(`/api/characters/${id}/merge`, json("POST", { targetId, version }));
  if (response.status === 409) throw new Error("This card changed. Reload the page, then merge.");
  if (!response.ok) throw new Error(await errorText(response, "Could not merge"));
  return (await response.json()) as { slug: string };
}

export async function deleteCard(id: string) {
  const response = await fetch(`/api/characters/${id}`, { method: "DELETE" });
  if (!response.ok) throw new Error(await errorText(response, "Could not delete"));
}

function putWithProgress(url: string, file: File, onProgress: (percent: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url);
    request.setRequestHeader("Content-Type", file.type);
    request.upload.onprogress = ({ loaded, total }) => onProgress(Math.round((loaded / total) * 100));
    request.onload = () =>
      request.status < 300 ? resolve() : reject(new Error(`Storage refused the upload (${request.status})`));
    // A CORS refusal shows up here, with no status to read.
    request.onerror = () =>
      reject(new Error("The upload was blocked. Check the R2 CORS rules in the README."));
    request.send(file);
  });
}

/** Sends a file straight to R2, then returns the key to attach. */
export async function uploadFile(
  characterId: string,
  file: File,
  kind: UploadKind,
  onProgress: (percent: number) => void,
) {
  const response = await fetch(
    `/api/characters/${characterId}/uploads`,
    json("POST", { kind, contentType: file.type, size: file.size }),
  );
  if (!response.ok) throw new Error(await errorText(response, "Could not start the upload"));

  const { url, key } = (await response.json()) as { url: string; key: string };
  await putWithProgress(url, file, onProgress);
  return key;
}

export async function attachPortrait(characterId: string, key: string) {
  const response = await fetch(`/api/characters/${characterId}/portrait`, json("POST", { key }));
  if (!response.ok) throw new Error(await errorText(response, "Could not save the portrait"));
}

export async function attachImage(characterId: string, key: string, caption: string | null) {
  const response = await fetch(`/api/characters/${characterId}/images`, json("POST", { key, caption }));
  if (!response.ok) throw new Error(await errorText(response, "Could not save the image"));
}

export async function saveImageOrder(characterId: string, ids: string[]) {
  // keepalive, so leaving straight after a drag does not cancel the save.
  await fetch(`/api/characters/${characterId}/images`, { ...json("PATCH", { ids }), keepalive: true });
}

export async function saveImageCaption(characterId: string, imageId: string, caption: string) {
  await fetch(`/api/characters/${characterId}/images/${imageId}`, { ...json("PATCH", { caption }), keepalive: true });
}

export async function removeImage(characterId: string, imageId: string) {
  await fetch(`/api/characters/${characterId}/images/${imageId}`, { method: "DELETE" });
}
