CREATE INDEX IF NOT EXISTS "audit_created_idx" ON "admin_audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "usage_created_idx" ON "usage_records" USING btree ("created_at");
