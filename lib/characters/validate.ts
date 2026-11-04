import { isHexColor } from "./colors";

export const ROLES = ["hero", "villain", "ally", "rival", "side", "other"] as const;

export type Role = (typeof ROLES)[number];

export type RelationshipInput = { relatedId: string; note: string | null };

export type CharacterFields = {
  name: string;
  fullName: string | null;
  role: Role | null;
  gift: string | null;
  appearance: string | null;
  personality: string | null;
  backstory: string | null;
  powers: string | null;
  notes: string | null;
  color: string | null;
  aliases: string[];
  relationships: RelationshipInput[];
};

export type CharacterPayload = CharacterFields & { version: number };

const MAX_SHORT = 200;
const MAX_LONG = 50_000;
const MAX_LIST = 200;

const SHORT_FIELDS = ["fullName", "gift"] as const;
const LONG_FIELDS = ["appearance", "personality", "backstory", "powers", "notes"] as const;

const isOptionalText = (value: unknown, max: number) =>
  value === undefined || value === null || (typeof value === "string" && value.length <= max);

const clean = (value: unknown) => (typeof value === "string" ? value.trim() || null : null);

/** Speaker names are stored in capitals, as scripts write them. */
export const normalizeName = (name: string) => name.trim().replace(/\s+/g, " ").toUpperCase();

function parseAliases(value: unknown) {
  if (!Array.isArray(value) || value.length > MAX_LIST) return null;
  if (!value.every((alias) => typeof alias === "string" && alias.length <= MAX_SHORT)) return null;
  return [...new Set((value as string[]).map(normalizeName).filter(Boolean))];
}

function parseRelationships(value: unknown): RelationshipInput[] | null {
  if (!Array.isArray(value) || value.length > MAX_LIST) return null;

  const rows: RelationshipInput[] = [];
  for (const row of value) {
    const { relatedId, note } = (row ?? {}) as Record<string, unknown>;
    if (typeof relatedId !== "string" || !isOptionalText(note, MAX_SHORT)) return null;
    rows.push({ relatedId, note: clean(note) });
  }
  return rows;
}

/** Returns the save to run, or null when the body is not one. */
export function parseCharacterPayload(body: unknown): CharacterPayload | null {
  if (typeof body !== "object" || body === null) return null;
  const input = body as Record<string, unknown>;
  const { version, name, role, color } = input;

  if (!Number.isInteger(version) || (version as number) < 1) return null;
  if (typeof name !== "string" || !name.trim() || name.length > MAX_SHORT) return null;
  if (role !== null && role !== undefined && !ROLES.includes(role as Role)) return null;
  if (color !== null && color !== undefined && (typeof color !== "string" || !isHexColor(color))) return null;
  if (!SHORT_FIELDS.every((field) => isOptionalText(input[field], MAX_SHORT))) return null;
  if (!LONG_FIELDS.every((field) => isOptionalText(input[field], MAX_LONG))) return null;

  const aliases = parseAliases(input.aliases ?? []);
  const relationships = parseRelationships(input.relationships ?? []);
  if (!aliases || !relationships) return null;

  return {
    version: version as number,
    name: normalizeName(name),
    fullName: clean(input.fullName),
    role: (role as Role | null | undefined) ?? null,
    gift: clean(input.gift),
    appearance: clean(input.appearance),
    personality: clean(input.personality),
    backstory: clean(input.backstory),
    powers: clean(input.powers),
    notes: clean(input.notes),
    color: (color as string | null | undefined) ?? null,
    aliases,
    relationships,
  };
}
