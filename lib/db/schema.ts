import { sql, type SQL } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

/**
 * Computed by Postgres from the row itself, so no save, restore or import can
 * leave it stale, and filling it in touches no version, revision or timestamp.
 */
const searchColumn = (expression: SQL) =>
  text("search_text").notNull().generatedAlwaysAs(expression);

const searchIndexes = (table: string, column: AnyPgColumn) => [
  index(`${table}_search_fts`).using("gin", sql`to_tsvector('simple', ${column})`),
  index(`${table}_search_trgm`).using("gin", sql`${column} gin_trgm_ops`),
];

export const episodeStatus = pgEnum("episode_status", [
  "idea",
  "drafting",
  "done",
]);

export const sceneKind = pgEnum("scene_kind", [
  "prologue",
  "scene",
  "outro",
  "post_credit",
]);

export const BEAT_TYPES = [
  "dialogue",
  "visual",
  "sound",
  "vo",
  "action",
  "note",
] as const;

export type BeatType = (typeof BEAT_TYPES)[number];

export type Beat = {
  id: string;
  type: BeatType;
  character?: string;
  parenthetical?: string;
  text: string;
};

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
});

export const series = pgTable("series", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description"),
  coverKey: text("cover_key"),
});

export const seasons = pgTable(
  "seasons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    seriesId: uuid("series_id")
      .notNull()
      .references(() => series.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    title: text("title"),
    summary: text("summary"),
    // Moves on with the settings and with the list of episodes.
    version: integer("version").notNull().default(1),
  },
  (t) => [unique().on(t.seriesId, t.number)],
);

export const episodes = pgTable(
  "episodes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    seasonId: uuid("season_id")
      .notNull()
      .references(() => seasons.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    title: text("title").notNull(),
    status: episodeStatus("status").notNull().default("idea"),
    summary: text("summary"),
    openingTheme: text("opening_theme"),
    outroTheme: text("outro_theme"),
    // Title, status, summary and themes.
    version: integer("version").notNull().default(1),
    // The list of scenes, kept apart so a reorder is never an edit to the episode.
    scenesVersion: integer("scenes_version").notNull().default(1),
    // Where the Word file puts it. Empty on episodes made on the site.
    importKey: text("import_key"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: uuid("deleted_by").references(() => users.id, {
      onDelete: "set null",
    }),
    searchText: searchColumn(sql`search_join(title, summary)`),
  },
  (t) => [
    ...searchIndexes("episodes", t.searchText),
    // Partial: a deleted episode's number is free for a new one.
    uniqueIndex("episodes_live_number_unique")
      .on(t.seasonId, t.number)
      .where(sql`deleted_at is null`),
    unique().on(t.seasonId, t.importKey),
  ],
);

export const scenes = pgTable(
  "scenes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    episodeId: uuid("episode_id")
      .notNull()
      .references(() => episodes.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    kind: sceneKind("kind").notNull().default("scene"),
    title: text("title"),
    timecode: text("timecode"),
    location: text("location"),
    beats: jsonb("beats").$type<Beat[]>().notNull().default([]),
    version: integer("version").notNull().default(1),
    updatedBy: uuid("updated_by").references(() => users.id, {
      onDelete: "set null",
    }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // Where the Word file puts it. Empty on scenes made on the site. A scene
    // has no season of its own, so import_season_id scopes the key's uniqueness
    // and stays put when the scene moves.
    importKey: text("import_key"),
    importSeasonId: uuid("import_season_id").references(() => seasons.id, {
      onDelete: "cascade",
    }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: uuid("deleted_by").references(() => users.id, {
      onDelete: "set null",
    }),
    searchText: searchColumn(sql`scene_search_text(title, location, beats)`),
  },
  // Not unique: drag-reordering rewrites positions row by row.
  (t) => [
    ...searchIndexes("scenes", t.searchText),
    index().on(t.episodeId, t.position),
    unique().on(t.importSeasonId, t.importKey),
  ],
);

export const sceneRevisions = pgTable(
  "scene_revisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sceneId: uuid("scene_id")
      .notNull()
      .references(() => scenes.id, { onDelete: "cascade" }),
    beats: jsonb("beats").$type<Beat[]>().notNull(),
    // Empty on revisions from before these columns existed.
    title: text("title"),
    timecode: text("timecode"),
    location: text("location"),
    // Set on the row a restore writes, so autosaves never merge into it.
    sealed: boolean("sealed").notNull().default(false),
    savedBy: uuid("saved_by").references(() => users.id, {
      onDelete: "set null",
    }),
    savedAt: timestamp("saved_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index().on(t.sceneId, t.savedAt)],
);

// Who has a scene open in the editor, refreshed by a heartbeat.
export const scenePresence = pgTable(
  "scene_presence",
  {
    sceneId: uuid("scene_id")
      .notNull()
      .references(() => scenes.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lastSeen: timestamp("last_seen", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.sceneId, t.userId] })],
);

export const characters = pgTable(
  "characters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    seriesId: uuid("series_id")
      .notNull()
      .references(() => series.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    fullName: text("full_name"),
    role: text("role"),
    gift: text("gift"),
    appearance: text("appearance"),
    personality: text("personality"),
    backstory: text("backstory"),
    powers: text("powers"),
    notes: text("notes"),
    color: text("color"),
    portraitKey: text("portrait_key"),
    slug: text("slug").notNull().unique(),
    // Other names scripts use for this character, in capitals.
    aliases: text("aliases").array().notNull().default(sql`'{}'::text[]`),
    version: integer("version").default(1),
    updatedBy: uuid("updated_by").references(() => users.id, {
      onDelete: "set null",
    }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
    searchText: searchColumn(
      sql`search_join(VARIADIC (ARRAY[name, full_name, role, gift, appearance, personality, backstory, notes] || aliases))`,
    ),
  },
  (t) => [...searchIndexes("characters", t.searchText), unique().on(t.seriesId, t.name)],
);

export const characterRelationships = pgTable(
  "character_relationships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    characterId: uuid("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    relatedId: uuid("related_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    note: text("note"),
    position: integer("position").notNull().default(0),
  },
  (t) => [index().on(t.characterId, t.position)],
);

export const characterImages = pgTable(
  "character_images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    characterId: uuid("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    r2Key: text("r2_key").notNull(),
    caption: text("caption"),
    position: integer("position").notNull().default(0),
  },
  (t) => [index().on(t.characterId, t.position)],
);

// Derived: rebuilt from a scene's beats on save. Deleted scenes have no rows.
export const sceneCharacters = pgTable(
  "scene_characters",
  {
    sceneId: uuid("scene_id")
      .notNull()
      .references(() => scenes.id, { onDelete: "cascade" }),
    characterId: uuid("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    lineCount: integer("line_count").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.sceneId, t.characterId] }),
    index().on(t.characterId),
  ],
);

export const loreEntries = pgTable(
  "lore_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    seriesId: uuid("series_id")
      .notNull()
      .references(() => series.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    slug: text("slug").notNull().unique(),
    category: text("category"),
    summary: text("summary"),
    body: text("body").notNull().default(""),
    coverKey: text("cover_key"),
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    // Other names scripts use for this, for "Mentioned in" and [[links]].
    aliases: text("aliases").array().notNull().default(sql`'{}'::text[]`),
    version: integer("version").notNull().default(1),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    updatedBy: uuid("updated_by").references(() => users.id, {
      onDelete: "set null",
    }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: uuid("deleted_by").references(() => users.id, {
      onDelete: "set null",
    }),
    searchText: searchColumn(
      sql`search_join(VARIADIC (ARRAY[title, summary, body] || tags || aliases))`,
    ),
  },
  (t) => [...searchIndexes("lore_entries", t.searchText), index().on(t.seriesId, t.category)],
);

export type LoreDraft = {
  title: string;
  category: string | null;
  summary: string | null;
  body: string;
  coverKey: string | null;
  tags: string[];
  aliases: string[];
};

export const loreRevisions = pgTable(
  "lore_revisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    loreId: uuid("lore_id")
      .notNull()
      .references(() => loreEntries.id, { onDelete: "cascade" }),
    content: jsonb("content").$type<LoreDraft>().notNull(),
    // Set on the row a restore writes, so autosaves never merge into it.
    sealed: boolean("sealed").notNull().default(false),
    savedBy: uuid("saved_by").references(() => users.id, {
      onDelete: "set null",
    }),
    savedAt: timestamp("saved_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index().on(t.loreId, t.savedAt)],
);

// One row per person per season: the last scene they read.
export const readingProgress = pgTable(
  "reading_progress",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    seasonId: uuid("season_id")
      .notNull()
      .references(() => seasons.id, { onDelete: "cascade" }),
    sceneId: uuid("scene_id")
      .notNull()
      .references(() => scenes.id, { onDelete: "cascade" }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.seasonId] })],
);

// Failed logins, for the rate limit. The key is a hash of an email or address.
export const loginAttempts = pgTable(
  "login_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull(),
    attemptedAt: timestamp("attempted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index().on(t.key, t.attemptedAt)],
);

// Who took a full backup, and when.
export const backupsLog = pgTable("backups_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
