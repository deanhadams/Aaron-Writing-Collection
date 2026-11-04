import type { SceneKind } from "@/lib/format";
import type { Status } from "./order";

const STATUSES: Status[] = ["idea", "drafting", "done"];
const KINDS: SceneKind[] = ["prologue", "scene", "outro", "post_credit"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Body = Record<string, unknown>;

const isBody = (value: unknown): value is Body => typeof value === "object" && value !== null;
const isVersion = (value: unknown): value is number => Number.isInteger(value) && (value as number) > 0;
const isUuidList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.length <= 2000 && value.every((id) => typeof id === "string" && UUID.test(id));

/** A trimmed string, or null when blank. Undefined when the value is not a string or null. */
function optionalText(value: unknown) {
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  return value.trim() || null;
}

export function parseVersion(body: unknown) {
  return isBody(body) && isVersion(body.version) ? body.version : null;
}

export function parseSeasonPatch(body: unknown) {
  if (!isBody(body) || !isVersion(body.version)) return null;
  const title = optionalText(body.title);
  const summary = optionalText(body.summary);
  if (title === undefined || summary === undefined) return null;
  return { version: body.version, title, summary };
}

export function parseNewEpisode(body: unknown) {
  if (!isBody(body) || !isVersion(body.version)) return null;
  const { number } = body;
  const title = optionalText(body.title);
  if (!Number.isInteger(number) || (number as number) < 1 || (number as number) > 9999 || !title) return null;
  return { version: body.version, number: number as number, title };
}

export function parseOrder(body: unknown) {
  if (!isBody(body) || !isVersion(body.version) || !isUuidList(body.ids)) return null;
  return { version: body.version, ids: body.ids };
}

/** Every field is optional, so an inline status change sends only the status. */
export function parseEpisodePatch(body: unknown) {
  if (!isBody(body) || !isVersion(body.version)) return null;

  const patch: {
    title?: string;
    status?: Status;
    summary?: string | null;
    openingTheme?: string | null;
    outroTheme?: string | null;
  } = {};

  if ("title" in body) {
    const title = optionalText(body.title);
    if (!title) return null;
    patch.title = title;
  }
  if ("status" in body) {
    if (!STATUSES.includes(body.status as Status)) return null;
    patch.status = body.status as Status;
  }
  for (const field of ["summary", "openingTheme", "outroTheme"] as const) {
    if (!(field in body)) continue;
    const text = optionalText(body[field]);
    if (text === undefined) return null;
    patch[field] = text;
  }

  return { version: body.version, patch };
}

export function parseNewScene(body: unknown) {
  if (!isBody(body) || !isVersion(body.version)) return null;
  const title = optionalText(body.title ?? null);
  const afterId = body.afterId ?? null;
  if (title === undefined || !KINDS.includes(body.kind as SceneKind)) return null;
  if (afterId !== null && !isUuidList([afterId])) return null;
  return { version: body.version, kind: body.kind as SceneKind, title, afterId: afterId as string | null };
}

export function parseSceneDetails(body: unknown) {
  if (!isBody(body) || !isVersion(body.version)) return null;
  const title = optionalText(body.title ?? null);
  if (title === undefined || !KINDS.includes(body.kind as SceneKind)) return null;
  return { version: body.version, title, kind: body.kind as SceneKind };
}

export function parseMove(body: unknown) {
  if (!isBody(body) || !isVersion(body.version) || !isUuidList([body.targetEpisodeId])) return null;
  return { version: body.version, targetEpisodeId: body.targetEpisodeId as string };
}
