ALTER TABLE "network_members" ADD COLUMN "accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "network_members" ADD COLUMN "invited_by_id" text;--> statement-breakpoint
ALTER TABLE "network_members" ADD CONSTRAINT "network_members_invited_by_id_users_id_fk" FOREIGN KEY ("invited_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- عضویت‌های پیش از این تغییر پذیرفته‌شده حساب می‌شوند
UPDATE "network_members" SET "accepted_at" = "created_at" WHERE "accepted_at" IS NULL;
