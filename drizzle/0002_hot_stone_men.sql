ALTER TABLE "scene_revisions" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "scene_revisions" ADD COLUMN "timecode" text;--> statement-breakpoint
ALTER TABLE "scene_revisions" ADD COLUMN "location" text;--> statement-breakpoint
ALTER TABLE "scene_revisions" ADD COLUMN "sealed" boolean DEFAULT false NOT NULL;