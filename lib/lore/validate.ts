import type { LoreDraft } from "@/lib/db/schema";
import { LORE_CATEGORIES } from "./categories";

const MAX_BODY = 200_000;
const MAX_LIST = 50;

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

function list(value: unknown) {
  if (!Array.isArray(value) || value.length > MAX_LIST) return null;
  return [...new Set(value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean))];
}

/** A key handed back by the browser must be one this entry could have been given. */
export const isLoreKey = (slug: string, key: string) =>
  key.startsWith(`lore/${slug}/`) && /^[a-z0-9/-]+\.(png|jpg|webp|gif)$/.test(key);

export function parseDraft(body: unknown, slug: string): LoreDraft | null {
  if (typeof body !== "object" || body === null) return null;
  const input = body as Record<string, unknown>;

  const title = text(input.title);
  const category = text(input.category);
  const tags = list(input.tags);
  const aliases = list(input.aliases);
  const coverKey = input.coverKey;

  if (!title || title.length > 200) return null;
  if (!LORE_CATEGORIES.some((name) => name === category)) return null;
  if (typeof input.body !== "string" || input.body.length > MAX_BODY) return null;
  if (!tags || !aliases) return null;
  if (coverKey !== null && (typeof coverKey !== "string" || !isLoreKey(slug, coverKey))) return null;

  return { title, category, summary: text(input.summary) || null, body: input.body, coverKey, tags, aliases };
}

export const parseVersion = (body: unknown) => {
  const version = (body as { version?: unknown } | null)?.version;
  return Number.isInteger(version) && (version as number) > 0 ? (version as number) : null;
};
