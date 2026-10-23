CREATE TYPE "public"."event_kind" AS ENUM('ONLINE', 'IN_PERSON');--> statement-breakpoint
CREATE TYPE "public"."event_status" AS ENUM('DRAFT', 'PUBLISHED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."mission_message_kind" AS ENUM('REPORT', 'FEEDBACK', 'REVISE', 'APPROVE', 'REPLY');--> statement-breakpoint
CREATE TYPE "public"."rahyar_layer" AS ENUM('DEPUTY', 'MANAGER', 'REGIONAL', 'PROVINCIAL', 'COUNTY');--> statement-breakpoint
CREATE TYPE "public"."registration_status" AS ENUM('REGISTERED', 'WAITLIST', 'PENDING', 'REJECTED', 'CANCELLED');--> statement-breakpoint
CREATE TABLE "direct_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"learner_id" text NOT NULL,
	"author_id" text NOT NULL,
	"body" text NOT NULL,
	"read_by_learner_at" timestamp with time zone,
	"read_by_rahyar_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_reminders" (
	"event_id" text NOT NULL,
	"kind" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_reminders_event_id_kind_pk" PRIMARY KEY("event_id","kind")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"agenda" text,
	"kind" "event_kind" NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"location" text,
	"map_url" text,
	"online_url" text,
	"bring" text,
	"host_name" text,
	"capacity" integer,
	"waitlist" boolean DEFAULT true NOT NULL,
	"requires_approval" boolean DEFAULT false NOT NULL,
	"registration_deadline" timestamp with time zone,
	"audience_gender" "gender",
	"audience_province_id" text,
	"audience_county_id" text,
	"course_id" text,
	"status" "event_status" DEFAULT 'DRAFT' NOT NULL,
	"cancel_reason" text,
	"created_by_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mission_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"learner_id" text NOT NULL,
	"lesson_id" text NOT NULL,
	"author_id" text NOT NULL,
	"kind" "mission_message_kind" NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "network_members" (
	"network_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "network_members_network_id_user_id_pk" PRIMARY KEY("network_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"link" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "private_files" (
	"key" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"kind" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rahyar_assignments" (
	"user_id" text PRIMARY KEY NOT NULL,
	"position_id" text NOT NULL,
	"assigned_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rahyar_positions" (
	"id" text PRIMARY KEY NOT NULL,
	"gender" "gender" NOT NULL,
	"layer" "rahyar_layer" NOT NULL,
	"title" text NOT NULL,
	"parent_id" text,
	"holder_id" text,
	"province_id" text,
	"county_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "region_provinces" (
	"region_id" text NOT NULL,
	"province_id" text NOT NULL,
	CONSTRAINT "region_provinces_region_id_province_id_pk" PRIMARY KEY("region_id","province_id")
);
--> statement-breakpoint
CREATE TABLE "registrations" (
	"event_id" text NOT NULL,
	"user_id" text NOT NULL,
	"status" "registration_status" NOT NULL,
	"check_in_code" text NOT NULL,
	"registered_by_id" text,
	"late_cancel" boolean DEFAULT false NOT NULL,
	"attended_at" timestamp with time zone,
	"attendance_method" text,
	"feedback" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "registrations_event_id_user_id_pk" PRIMARY KEY("event_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "mosques" ADD COLUMN "invite_code" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "allow_rahyar_messages" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_learner_id_users_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_reminders" ADD CONSTRAINT "event_reminders_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_audience_province_id_provinces_id_fk" FOREIGN KEY ("audience_province_id") REFERENCES "public"."provinces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_audience_county_id_counties_id_fk" FOREIGN KEY ("audience_county_id") REFERENCES "public"."counties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mission_messages" ADD CONSTRAINT "mission_messages_learner_id_users_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mission_messages" ADD CONSTRAINT "mission_messages_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mission_messages" ADD CONSTRAINT "mission_messages_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "network_members" ADD CONSTRAINT "network_members_network_id_networks_id_fk" FOREIGN KEY ("network_id") REFERENCES "public"."networks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "network_members" ADD CONSTRAINT "network_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private_files" ADD CONSTRAINT "private_files_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rahyar_assignments" ADD CONSTRAINT "rahyar_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rahyar_assignments" ADD CONSTRAINT "rahyar_assignments_position_id_rahyar_positions_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."rahyar_positions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rahyar_assignments" ADD CONSTRAINT "rahyar_assignments_assigned_by_id_users_id_fk" FOREIGN KEY ("assigned_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rahyar_positions" ADD CONSTRAINT "rahyar_positions_holder_id_users_id_fk" FOREIGN KEY ("holder_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rahyar_positions" ADD CONSTRAINT "rahyar_positions_province_id_provinces_id_fk" FOREIGN KEY ("province_id") REFERENCES "public"."provinces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rahyar_positions" ADD CONSTRAINT "rahyar_positions_county_id_counties_id_fk" FOREIGN KEY ("county_id") REFERENCES "public"."counties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "region_provinces" ADD CONSTRAINT "region_provinces_region_id_rahyar_positions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."rahyar_positions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "region_provinces" ADD CONSTRAINT "region_provinces_province_id_provinces_id_fk" FOREIGN KEY ("province_id") REFERENCES "public"."provinces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_registered_by_id_users_id_fk" FOREIGN KEY ("registered_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dm_learner_idx" ON "direct_messages" USING btree ("learner_id","created_at");--> statement-breakpoint
CREATE INDEX "events_starts_idx" ON "events" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "mission_msg_idx" ON "mission_messages" USING btree ("learner_id","lesson_id");--> statement-breakpoint
CREATE INDEX "notif_user_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "rahyar_parent_idx" ON "rahyar_positions" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "rahyar_holder_idx" ON "rahyar_positions" USING btree ("holder_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reg_checkin_uq" ON "registrations" USING btree ("event_id","check_in_code");--> statement-breakpoint
ALTER TABLE "mosques" ADD CONSTRAINT "mosques_invite_code_unique" UNIQUE("invite_code");