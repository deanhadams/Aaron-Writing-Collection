CREATE TABLE "character_relationships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"character_id" uuid NOT NULL,
	"related_id" uuid NOT NULL,
	"note" text,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "powers" text;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "slug" text;--> statement-breakpoint
UPDATE "characters" SET "slug" = COALESCE(substring("portrait_key" from '^characters/(.+)\.[a-z]+$'), "id"::text);--> statement-breakpoint
ALTER TABLE "characters" ALTER COLUMN "slug" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "aliases" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "version" integer DEFAULT 1;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now();--> statement-breakpoint
ALTER TABLE "character_relationships" ADD CONSTRAINT "character_relationships_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_relationships" ADD CONSTRAINT "character_relationships_related_id_characters_id_fk" FOREIGN KEY ("related_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "character_relationships_character_id_position_index" ON "character_relationships" USING btree ("character_id","position");--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_slug_unique" UNIQUE("slug");