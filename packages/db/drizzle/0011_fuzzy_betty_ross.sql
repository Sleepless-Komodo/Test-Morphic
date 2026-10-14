ALTER TABLE "payments" ADD COLUMN "capture_id" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "reconcile_checked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "refunded_amount_minor_units" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "ledger_refund_reference_unique" ON "credit_ledger" USING btree ("reference") WHERE "credit_ledger"."entry_type" = 'refund';--> statement-breakpoint
CREATE INDEX "payments_open_idx" ON "payments" USING btree ("status","created_at") WHERE status IN ('pending','pending_paypal','capturing');--> statement-breakpoint
CREATE UNIQUE INDEX "payments_capture_unique" ON "payments" USING btree ("capture_id") WHERE capture_id IS NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_status_check" CHECK (status IN ('pending','capturing','paid','pending_paypal','failed','expired','refunded','needs_review','disputed'));