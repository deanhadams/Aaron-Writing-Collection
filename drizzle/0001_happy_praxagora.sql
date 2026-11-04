CREATE TABLE "scene_presence" (
	"scene_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"last_seen" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scene_presence_scene_id_user_id_pk" PRIMARY KEY("scene_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "scene_presence" ADD CONSTRAINT "scene_presence_scene_id_scenes_id_fk" FOREIGN KEY ("scene_id") REFERENCES "public"."scenes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_presence" ADD CONSTRAINT "scene_presence_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;