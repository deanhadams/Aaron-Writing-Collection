import { BEAT_TYPES, type Beat, type BeatType } from "@/lib/db/schema";
import { normalizeBeat } from "@/lib/script/beat-fields";

const MAX_BEATS = 2000;
const MAX_TEXT = 20_000;
const MAX_FIELD = 300;

export type SceneFields = {
  title: string | null;
  timecode: string | null;
  location: string | null;
  beats: Beat[];
};

export type SavePayload = SceneFields & { version: number };

const isText = (value: unknown, max: number): value is string =>
  typeof value === "string" && value.length <= max;

const isOptional = (value: unknown, max: number) =>
  value === undefined || value === null || isText(value, max);

function headerField(value: unknown) {
  return typeof value === "string" ? value.trim() || null : null;
}

function isBeat(value: unknown): value is Beat {
  if (typeof value !== "object" || value === null) return false;
  const { id, type, text, character, parenthetical } = value as Record<string, unknown>;

  return (
    isText(id, 64) &&
    id.length > 0 &&
    BEAT_TYPES.includes(type as BeatType) &&
    isText(text, MAX_TEXT) &&
    isOptional(character, MAX_FIELD) &&
    isOptional(parenthetical, MAX_TEXT)
  );
}

/** Returns the save to run, or null when the body is not one. */
export function parseSavePayload(body: unknown): SavePayload | null {
  if (typeof body !== "object" || body === null) return null;
  const { version, title, timecode, location, beats } = body as Record<string, unknown>;

  if (!Number.isInteger(version) || (version as number) < 1) return null;
  if (![title, timecode, location].every((field) => isOptional(field, MAX_FIELD))) return null;
  if (!Array.isArray(beats) || beats.length > MAX_BEATS || !beats.every(isBeat)) return null;
  if (new Set(beats.map(({ id }) => id)).size !== beats.length) return null;

  return {
    version: version as number,
    title: headerField(title),
    timecode: headerField(timecode),
    location: headerField(location),
    beats: beats.map(normalizeBeat),
  };
}
