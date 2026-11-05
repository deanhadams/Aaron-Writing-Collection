CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE FUNCTION search_clean(value text) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE
  AS $$ SELECT lower(regexp_replace(coalesce(value, ''), '[''’]', '', 'g')) $$;--> statement-breakpoint
CREATE FUNCTION search_join(VARIADIC parts text[]) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE
  AS $$ SELECT search_clean(array_to_string(parts, ' ')) $$;--> statement-breakpoint
CREATE FUNCTION scene_search_text(title text, location text, beats jsonb) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE
  AS $$
    SELECT search_join(
      title,
      location,
      (
        SELECT string_agg(concat_ws(' ', beat->>'character', beat->>'parenthetical', beat->>'text'), ' ')
        FROM jsonb_array_elements(beats) AS beat
      )
    )
  $$;--> statement-breakpoint
CREATE TABLE "lore_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lore_id" uuid NOT NULL,
	"content" jsonb NOT NULL,
	"sealed" boolean DEFAULT false NOT NULL,
	"saved_by" uuid,
	"saved_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "search_text" text GENERATED ALWAYS AS (search_join(VARIADIC (ARRAY[name, full_name, role, gift, appearance, personality, backstory, notes] || aliases))) STORED NOT NULL;--> statement-breakpoint
ALTER TABLE "episodes" ADD COLUMN "search_text" text GENERATED ALWAYS AS (search_join(title, summary)) STORED NOT NULL;--> statement-breakpoint
ALTER TABLE "lore_entries" ADD COLUMN "slug" text;--> statement-breakpoint
UPDATE "lore_entries" SET "slug" = trim(both '-' from regexp_replace(lower("title"), '[^a-z0-9]+', '-', 'g')) || '-' || left("id"::text, 8);--> statement-breakpoint
ALTER TABLE "lore_entries" ALTER COLUMN "slug" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "lore_entries" ADD COLUMN "summary" text;--> statement-breakpoint
ALTER TABLE "lore_entries" ADD COLUMN "cover_key" text;--> statement-breakpoint
ALTER TABLE "lore_entries" ADD COLUMN "tags" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "lore_entries" ADD COLUMN "aliases" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "lore_entries" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "lore_entries" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "lore_entries" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "lore_entries" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "lore_entries" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "lore_entries" ADD COLUMN "deleted_by" uuid;--> statement-breakpoint
ALTER TABLE "lore_entries" ADD COLUMN "search_text" text GENERATED ALWAYS AS (search_join(VARIADIC (ARRAY[title, summary, body] || tags || aliases))) STORED NOT NULL;--> statement-breakpoint
ALTER TABLE "scenes" ADD COLUMN "search_text" text GENERATED ALWAYS AS (scene_search_text(title, location, beats)) STORED NOT NULL;--> statement-breakpoint
ALTER TABLE "lore_revisions" ADD CONSTRAINT "lore_revisions_lore_id_lore_entries_id_fk" FOREIGN KEY ("lore_id") REFERENCES "public"."lore_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lore_revisions" ADD CONSTRAINT "lore_revisions_saved_by_users_id_fk" FOREIGN KEY ("saved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lore_revisions_lore_id_saved_at_index" ON "lore_revisions" USING btree ("lore_id","saved_at");--> statement-breakpoint
ALTER TABLE "lore_entries" ADD CONSTRAINT "lore_entries_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lore_entries" ADD CONSTRAINT "lore_entries_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lore_entries" ADD CONSTRAINT "lore_entries_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "characters_search_fts" ON "characters" USING gin (to_tsvector('simple', "search_text"));--> statement-breakpoint
CREATE INDEX "characters_search_trgm" ON "characters" USING gin ("search_text" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "episodes_search_fts" ON "episodes" USING gin (to_tsvector('simple', "search_text"));--> statement-breakpoint
CREATE INDEX "episodes_search_trgm" ON "episodes" USING gin ("search_text" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "lore_entries_search_fts" ON "lore_entries" USING gin (to_tsvector('simple', "search_text"));--> statement-breakpoint
CREATE INDEX "lore_entries_search_trgm" ON "lore_entries" USING gin ("search_text" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "scenes_search_fts" ON "scenes" USING gin (to_tsvector('simple', "search_text"));--> statement-breakpoint
CREATE INDEX "scenes_search_trgm" ON "scenes" USING gin ("search_text" gin_trgm_ops);--> statement-breakpoint
ALTER TABLE "lore_entries" ADD CONSTRAINT "lore_entries_slug_unique" UNIQUE("slug");