CREATE TYPE "public"."course_status" AS ENUM('DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."dependency_kind" AS ENUM('PREREQUISITE', 'COREQUISITE');--> statement-breakpoint
CREATE TYPE "public"."gender" AS ENUM('MALE', 'FEMALE');--> statement-breakpoint
CREATE TYPE "public"."lesson_type" AS ENUM('VIDEO', 'AUDIO', 'TEXT', 'QUIZ', 'PRACTICE', 'WORKSHEET', 'MISSION', 'TOOL');--> statement-breakpoint
CREATE TYPE "public"."mission_rule" AS ENUM('ON_SUBMIT', 'ON_APPROVAL');--> statement-breakpoint
CREATE TYPE "public"."network_kind" AS ENUM('BROTHERS', 'BANOUR', 'ORGANIZATION');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('HQ_ADMIN', 'HQ_OPERATOR', 'INSTRUCTOR', 'RAHYAR', 'IMAM', 'ORG_ADMIN');--> statement-breakpoint
CREATE TABLE "access_grants" (
	"id" text PRIMARY KEY NOT NULL,
	"course_id" text NOT NULL,
	"user_id" text,
	"network_id" text,
	"issued_by_id" text NOT NULL,
	"expires_at" timestamp with time zone,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_id" text,
	"action" text NOT NULL,
	"target" text,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "certificates" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"user_id" text NOT NULL,
	"course_id" text NOT NULL,
	"holder_name" text NOT NULL,
	"course_title" text NOT NULL,
	"score" integer,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "certificates_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "core_memberships" (
	"core_id" text NOT NULL,
	"user_id" text NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "core_memberships_core_id_user_id_pk" PRIMARY KEY("core_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "cores" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"network_id" text NOT NULL,
	"mosque_id" text,
	"leader_id" text,
	"invite_code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cores_invite_code_unique" UNIQUE("invite_code")
);
--> statement-breakpoint
CREATE TABLE "counties" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"province_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "course_dependencies" (
	"course_id" text NOT NULL,
	"requires_id" text NOT NULL,
	"kind" "dependency_kind" NOT NULL,
	CONSTRAINT "course_dependencies_course_id_requires_id_pk" PRIMARY KEY("course_id","requires_id")
);
--> statement-breakpoint
CREATE TABLE "courses" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"subtitle" text,
	"about" text,
	"level" text,
	"instructor" text,
	"color" text DEFAULT 'green' NOT NULL,
	"icon" text DEFAULT 'book-open' NOT NULL,
	"status" "course_status" DEFAULT 'DRAFT' NOT NULL,
	"is_restricted" boolean DEFAULT false NOT NULL,
	"pass_score" integer DEFAULT 60 NOT NULL,
	"mission_rule" "mission_rule" DEFAULT 'ON_SUBMIT' NOT NULL,
	"has_certificate" boolean DEFAULT true NOT NULL,
	"outcomes" text[] DEFAULT '{}'::text[] NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "courses_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "enrollments" (
	"user_id" text NOT NULL,
	"course_id" text NOT NULL,
	"course_version" integer DEFAULT 1 NOT NULL,
	"last_lesson_id" text,
	"enrolled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	CONSTRAINT "enrollments_user_id_course_id_pk" PRIMARY KEY("user_id","course_id")
);
--> statement-breakpoint
CREATE TABLE "lesson_progress" (
	"user_id" text NOT NULL,
	"lesson_id" text NOT NULL,
	"position_sec" integer DEFAULT 0 NOT NULL,
	"completed_at" timestamp with time zone,
	"data" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lesson_progress_user_id_lesson_id_pk" PRIMARY KEY("user_id","lesson_id")
);
--> statement-breakpoint
CREATE TABLE "lessons" (
	"id" text PRIMARY KEY NOT NULL,
	"module_id" text NOT NULL,
	"title" text NOT NULL,
	"type" "lesson_type" NOT NULL,
	"order" integer NOT NULL,
	"duration_sec" integer DEFAULT 0 NOT NULL,
	"required" boolean DEFAULT true NOT NULL,
	"is_final_quiz" boolean DEFAULT false NOT NULL,
	"content" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "modules" (
	"id" text PRIMARY KEY NOT NULL,
	"course_id" text NOT NULL,
	"title" text NOT NULL,
	"order" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mosques" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"county_id" text NOT NULL,
	"address" text,
	"verified" boolean DEFAULT false NOT NULL,
	"imam_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "networks" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" "network_kind" NOT NULL,
	"name" text NOT NULL,
	"under_rahyar" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "otp_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"mobile" text NOT NULL,
	"code_hash" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "path_items" (
	"path_id" text NOT NULL,
	"course_id" text NOT NULL,
	"order" integer NOT NULL,
	CONSTRAINT "path_items_path_id_course_id_pk" PRIMARY KEY("path_id","course_id")
);
--> statement-breakpoint
CREATE TABLE "paths" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"icon" text DEFAULT 'route' NOT NULL,
	"color" text DEFAULT 'green' NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "paths_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "provinces" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "provinces_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "quiz_attempts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"lesson_id" text NOT NULL,
	"answers" jsonb NOT NULL,
	"score" integer NOT NULL,
	"passed" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_grants" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"role" "role" NOT NULL,
	"network_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"user_agent" text,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"mobile" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"gender" "gender",
	"national_id" text,
	"county_id" text,
	"mosque_id" text,
	"near_mosque" text,
	"core_sso_id" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"delete_requested_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_mobile_unique" UNIQUE("mobile"),
	CONSTRAINT "users_core_sso_id_unique" UNIQUE("core_sso_id")
);
--> statement-breakpoint
ALTER TABLE "access_grants" ADD CONSTRAINT "access_grants_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_grants" ADD CONSTRAINT "access_grants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_grants" ADD CONSTRAINT "access_grants_network_id_networks_id_fk" FOREIGN KEY ("network_id") REFERENCES "public"."networks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_grants" ADD CONSTRAINT "access_grants_issued_by_id_users_id_fk" FOREIGN KEY ("issued_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core_memberships" ADD CONSTRAINT "core_memberships_core_id_cores_id_fk" FOREIGN KEY ("core_id") REFERENCES "public"."cores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core_memberships" ADD CONSTRAINT "core_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cores" ADD CONSTRAINT "cores_network_id_networks_id_fk" FOREIGN KEY ("network_id") REFERENCES "public"."networks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cores" ADD CONSTRAINT "cores_mosque_id_mosques_id_fk" FOREIGN KEY ("mosque_id") REFERENCES "public"."mosques"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cores" ADD CONSTRAINT "cores_leader_id_users_id_fk" FOREIGN KEY ("leader_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "counties" ADD CONSTRAINT "counties_province_id_provinces_id_fk" FOREIGN KEY ("province_id") REFERENCES "public"."provinces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_dependencies" ADD CONSTRAINT "course_dependencies_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_dependencies" ADD CONSTRAINT "course_dependencies_requires_id_courses_id_fk" FOREIGN KEY ("requires_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modules" ADD CONSTRAINT "modules_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mosques" ADD CONSTRAINT "mosques_county_id_counties_id_fk" FOREIGN KEY ("county_id") REFERENCES "public"."counties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "path_items" ADD CONSTRAINT "path_items_path_id_paths_id_fk" FOREIGN KEY ("path_id") REFERENCES "public"."paths"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "path_items" ADD CONSTRAINT "path_items_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_grants" ADD CONSTRAINT "role_grants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_grants" ADD CONSTRAINT "role_grants_network_id_networks_id_fk" FOREIGN KEY ("network_id") REFERENCES "public"."networks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_county_id_counties_id_fk" FOREIGN KEY ("county_id") REFERENCES "public"."counties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_mosque_id_mosques_id_fk" FOREIGN KEY ("mosque_id") REFERENCES "public"."mosques"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "grant_course_idx" ON "access_grants" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "audit_created_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "cert_user_course_uq" ON "certificates" USING btree ("user_id","course_id");--> statement-breakpoint
CREATE UNIQUE INDEX "county_uq" ON "counties" USING btree ("province_id","name");--> statement-breakpoint
CREATE INDEX "otp_mobile_idx" ON "otp_requests" USING btree ("mobile","created_at");--> statement-breakpoint
CREATE INDEX "attempt_user_lesson_idx" ON "quiz_attempts" USING btree ("user_id","lesson_id");--> statement-breakpoint
CREATE UNIQUE INDEX "role_grant_uq" ON "role_grants" USING btree ("user_id","role","network_id");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");