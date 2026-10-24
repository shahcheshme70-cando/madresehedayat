ALTER TYPE "public"."lesson_type" ADD VALUE 'LIVE';--> statement-breakpoint
CREATE TABLE "live_attendance" (
	"event_id" text NOT NULL,
	"user_id" text NOT NULL,
	"seconds" integer DEFAULT 0 NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "live_attendance_event_id_user_id_pk" PRIMARY KEY("event_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "live_recordings" (
	"record_id" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"url" text NOT NULL,
	"duration_sec" integer,
	"started_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "use_bbb" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "record" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "live_finalized_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "live_attendance" ADD CONSTRAINT "live_attendance_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_attendance" ADD CONSTRAINT "live_attendance_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_recordings" ADD CONSTRAINT "live_recordings_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;