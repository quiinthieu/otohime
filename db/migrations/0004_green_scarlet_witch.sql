CREATE TABLE "guestbook_entry" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"v" integer NOT NULL,
	"strokes" jsonb NOT NULL,
	"duration_ms" integer NOT NULL,
	"point_count" integer NOT NULL,
	"byte_count" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"tilt" integer NOT NULL,
	"tape" integer NOT NULL,
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp (6) with time zone,
	"reviewed_by" text,
	CONSTRAINT "guestbook_status_check" CHECK ("guestbook_entry"."status" in ('pending', 'approved', 'rejected')),
	CONSTRAINT "guestbook_tilt_check" CHECK ("guestbook_entry"."tilt" between -4 and 4),
	CONSTRAINT "guestbook_tape_check" CHECK ("guestbook_entry"."tape" between 0 and 3),
	CONSTRAINT "guestbook_v_check" CHECK ("guestbook_entry"."v" = 1)
);
--> statement-breakpoint
CREATE TABLE "guestbook_usage" (
	"bucket" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"updated_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "guestbook_usage_count_check" CHECK ("guestbook_usage"."count" >= 0)
);
--> statement-breakpoint
ALTER TABLE "guestbook_entry" ADD CONSTRAINT "guestbook_entry_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "guestbook_public_idx" ON "guestbook_entry" USING btree ("status","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);