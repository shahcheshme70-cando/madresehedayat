CREATE TABLE "invoices" (
	"id" text PRIMARY KEY NOT NULL,
	"number" text NOT NULL,
	"network_id" text,
	"subscription_id" text,
	"service_order_id" text,
	"sponsor_id" text,
	"title" text NOT NULL,
	"amount" bigint NOT NULL,
	"status" text DEFAULT 'ISSUED' NOT NULL,
	"paid_at" timestamp with time zone,
	"payment_ref" text,
	"method" text,
	"created_by_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "service_orders" (
	"id" text PRIMARY KEY NOT NULL,
	"network_id" text,
	"sponsor_id" text,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"costs" jsonb NOT NULL,
	"cost" bigint NOT NULL,
	"price" bigint NOT NULL,
	"status" text DEFAULT 'PROPOSED' NOT NULL,
	"course_id" text,
	"note" text,
	"created_by_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sponsors" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"terms_accepted" boolean DEFAULT false NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_courses" (
	"subscription_id" text NOT NULL,
	"course_id" text NOT NULL,
	CONSTRAINT "subscription_courses_subscription_id_course_id_pk" PRIMARY KEY("subscription_id","course_id")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"network_id" text NOT NULL,
	"plan" text NOT NULL,
	"seats" integer NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"contract_no" text,
	"price_per_seat" bigint NOT NULL,
	"discount_pct" integer DEFAULT 0 NOT NULL,
	"fixed_fee" bigint DEFAULT 0 NOT NULL,
	"amount" bigint NOT NULL,
	"note" text,
	"cancelled_at" timestamp with time zone,
	"reminded_at" jsonb,
	"created_by_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "network_id" text;--> statement-breakpoint
ALTER TABLE "certificates" ADD COLUMN "org_name" text;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "sponsor_id" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "audience_network_id" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "audience_mosque_id" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "audience_core_id" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "fee_note" text;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "priority" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_network_id_networks_id_fk" FOREIGN KEY ("network_id") REFERENCES "public"."networks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_service_order_id_service_orders_id_fk" FOREIGN KEY ("service_order_id") REFERENCES "public"."service_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_sponsor_id_sponsors_id_fk" FOREIGN KEY ("sponsor_id") REFERENCES "public"."sponsors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_network_id_networks_id_fk" FOREIGN KEY ("network_id") REFERENCES "public"."networks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_sponsor_id_sponsors_id_fk" FOREIGN KEY ("sponsor_id") REFERENCES "public"."sponsors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_courses" ADD CONSTRAINT "subscription_courses_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_courses" ADD CONSTRAINT "subscription_courses_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_network_id_networks_id_fk" FOREIGN KEY ("network_id") REFERENCES "public"."networks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invoices_network_idx" ON "invoices" USING btree ("network_id");--> statement-breakpoint
CREATE INDEX "subs_network_idx" ON "subscriptions" USING btree ("network_id","ends_at");--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_network_id_networks_id_fk" FOREIGN KEY ("network_id") REFERENCES "public"."networks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_sponsor_id_sponsors_id_fk" FOREIGN KEY ("sponsor_id") REFERENCES "public"."sponsors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_audience_network_id_networks_id_fk" FOREIGN KEY ("audience_network_id") REFERENCES "public"."networks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_audience_mosque_id_mosques_id_fk" FOREIGN KEY ("audience_mosque_id") REFERENCES "public"."mosques"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_audience_core_id_cores_id_fk" FOREIGN KEY ("audience_core_id") REFERENCES "public"."cores"("id") ON DELETE no action ON UPDATE no action;