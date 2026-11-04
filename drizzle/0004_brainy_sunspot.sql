ALTER TABLE "episodes" DROP CONSTRAINT "episodes_season_id_number_unique";--> statement-breakpoint
ALTER TABLE "episodes" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "episodes" ADD COLUMN "scenes_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "episodes" ADD COLUMN "import_key" text;--> statement-breakpoint
ALTER TABLE "episodes" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "episodes" ADD COLUMN "deleted_by" uuid;--> statement-breakpoint
ALTER TABLE "scenes" ADD COLUMN "import_key" text;--> statement-breakpoint
ALTER TABLE "scenes" ADD COLUMN "import_season_id" uuid;--> statement-breakpoint
ALTER TABLE "scenes" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "scenes" ADD COLUMN "deleted_by" uuid;--> statement-breakpoint
ALTER TABLE "seasons" ADD COLUMN "summary" text;--> statement-breakpoint
ALTER TABLE "seasons" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
UPDATE "episodes" SET "import_key" = 'e' || "number";--> statement-breakpoint
UPDATE "scenes" SET "import_key" = 'e' || "episodes"."number" || ':s' || "scenes"."position", "import_season_id" = "episodes"."season_id" FROM "episodes" WHERE "scenes"."episode_id" = "episodes"."id";--> statement-breakpoint
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenes" ADD CONSTRAINT "scenes_import_season_id_seasons_id_fk" FOREIGN KEY ("import_season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenes" ADD CONSTRAINT "scenes_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "episodes_live_number_unique" ON "episodes" USING btree ("season_id","number") WHERE deleted_at is null;--> statement-breakpoint
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_season_id_import_key_unique" UNIQUE("season_id","import_key");--> statement-breakpoint
ALTER TABLE "scenes" ADD CONSTRAINT "scenes_import_season_id_import_key_unique" UNIQUE("import_season_id","import_key");