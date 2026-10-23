-- پاک کردن نقش‌های تکراری پیش از قید یکتایی
DELETE FROM "role_grants" a USING "role_grants" b WHERE a.ctid > b.ctid AND a.user_id = b.user_id AND a.role = b.role AND a.network_id IS NOT DISTINCT FROM b.network_id;--> statement-breakpoint
DROP INDEX "role_grant_uq";--> statement-breakpoint
ALTER TABLE "role_grants" ADD CONSTRAINT "role_grant_uq" UNIQUE NULLS NOT DISTINCT("user_id","role","network_id");