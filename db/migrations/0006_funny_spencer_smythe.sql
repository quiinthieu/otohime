CREATE TABLE "inkblot_answer" (
	"id" text PRIMARY KEY NOT NULL,
	"blot_key" text NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"note" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"tilt" integer NOT NULL,
	"hand" integer NOT NULL,
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp (6) with time zone,
	"reviewed_by" text,
	CONSTRAINT "inkblot_status_check" CHECK ("inkblot_answer"."status" in ('pending', 'approved', 'rejected')),
	CONSTRAINT "inkblot_tilt_check" CHECK ("inkblot_answer"."tilt" between -4 and 4),
	CONSTRAINT "inkblot_hand_check" CHECK ("inkblot_answer"."hand" between 0 and 2),
	CONSTRAINT "inkblot_text_check" CHECK (char_length("inkblot_answer"."name") <= 24 and char_length("inkblot_answer"."note") between 1 and 80)
);
--> statement-breakpoint
CREATE TABLE "inkblot_usage" (
	"bucket" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"updated_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inkblot_usage_count_check" CHECK ("inkblot_usage"."count" >= 0)
);
--> statement-breakpoint
ALTER TABLE "inkblot_answer" ADD CONSTRAINT "inkblot_answer_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inkblot_public_idx" ON "inkblot_answer" USING btree ("blot_key","status","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);