CREATE TABLE "backups_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reading_progress" (
	"user_id" uuid NOT NULL,
	"season_id" uuid NOT NULL,
	"scene_id" uuid NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reading_progress_user_id_season_id_pk" PRIMARY KEY("user_id","season_id")
);
--> statement-breakpoint
ALTER TABLE "backups_log" ADD CONSTRAINT "backups_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_progress" ADD CONSTRAINT "reading_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_progress" ADD CONSTRAINT "reading_progress_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_progress" ADD CONSTRAINT "reading_progress_scene_id_scenes_id_fk" FOREIGN KEY ("scene_id") REFERENCES "public"."scenes"("id") ON DELETE cascade ON UPDATE no action;