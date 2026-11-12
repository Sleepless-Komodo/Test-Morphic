CREATE TABLE IF NOT EXISTS "abuse_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"api_key_id" uuid,
	"signal_type" text NOT NULL,
	"severity" text DEFAULT 'medium' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"fingerprint" text NOT NULL,
	"summary" text NOT NULL,
	"metadata" jsonb,
	"resolution_note" text,
	"resolved_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "abuse_cases" ADD CONSTRAINT "abuse_cases_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "abuse_cases" ADD CONSTRAINT "abuse_cases_api_key_id_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "abuse_cases" ADD CONSTRAINT "abuse_cases_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "abuse_cases_status_created_idx" ON "abuse_cases" USING btree ("status","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "abuse_cases_user_idx" ON "abuse_cases" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "abuse_cases_fingerprint_idx" ON "abuse_cases" USING btree ("fingerprint");
