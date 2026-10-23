CREATE TABLE "campaign_cores" (
	"campaign_id" text NOT NULL,
	"core_id" text NOT NULL,
	"joined_by_id" text NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campaign_cores_campaign_id_core_id_pk" PRIMARY KEY("campaign_id","core_id")
);
--> statement-breakpoint
CREATE TABLE "campaign_done" (
	"task_id" text NOT NULL,
	"user_id" text NOT NULL,
	"campaign_id" text NOT NULL,
	"province_id" text,
	"note" text,
	"done_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campaign_done_task_id_user_id_pk" PRIMARY KEY("task_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "campaign_members" (
	"campaign_id" text NOT NULL,
	"user_id" text NOT NULL,
	"core_id" text,
	"province_id" text,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campaign_members_campaign_id_user_id_pk" PRIMARY KEY("campaign_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "campaign_tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"campaign_id" text NOT NULL,
	"order" integer NOT NULL,
	"title" text NOT NULL,
	"body" text
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"body" text,
	"scope" text NOT NULL,
	"province_id" text,
	"goal" integer,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"created_by_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "campaign_cores" ADD CONSTRAINT "campaign_cores_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_cores" ADD CONSTRAINT "campaign_cores_core_id_cores_id_fk" FOREIGN KEY ("core_id") REFERENCES "public"."cores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_cores" ADD CONSTRAINT "campaign_cores_joined_by_id_users_id_fk" FOREIGN KEY ("joined_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_done" ADD CONSTRAINT "campaign_done_task_id_campaign_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."campaign_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_done" ADD CONSTRAINT "campaign_done_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_done" ADD CONSTRAINT "campaign_done_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_done" ADD CONSTRAINT "campaign_done_province_id_provinces_id_fk" FOREIGN KEY ("province_id") REFERENCES "public"."provinces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_members" ADD CONSTRAINT "campaign_members_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_members" ADD CONSTRAINT "campaign_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_members" ADD CONSTRAINT "campaign_members_core_id_cores_id_fk" FOREIGN KEY ("core_id") REFERENCES "public"."cores"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_members" ADD CONSTRAINT "campaign_members_province_id_provinces_id_fk" FOREIGN KEY ("province_id") REFERENCES "public"."provinces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_tasks" ADD CONSTRAINT "campaign_tasks_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_province_id_provinces_id_fk" FOREIGN KEY ("province_id") REFERENCES "public"."provinces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "campaign_done_idx" ON "campaign_done" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "campaigns_time_idx" ON "campaigns" USING btree ("status","ends_at");