import { sql } from "drizzle-orm";
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
  uuid,
} from "drizzle-orm/pg-core";

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
  },
  (t) => [unique().on(t.seasonId, t.number)],
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
  },
  // Not unique: drag-reordering rewrites positions row by row.
  (t) => [index().on(t.episodeId, t.position)],
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
  },
  (t) => [unique().on(t.seriesId, t.name)],
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

// Derived: rebuilt from a scene's beats every time the scene is saved.
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
    category: text("category"),
    body: text("body").notNull().default(""),
  },
  (t) => [index().on(t.seriesId, t.category)],
);
