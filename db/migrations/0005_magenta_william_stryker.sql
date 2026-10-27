CREATE TABLE "bottle_suggestion" (
	"id" text PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"title" text NOT NULL,
	"note" text NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"submitter_hmac" text NOT NULL,
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bottle_suggestion_url_unique" UNIQUE("url"),
	CONSTRAINT "bottle_status_check" CHECK ("bottle_suggestion"."status" in ('pending','approved','rejected')),
	CONSTRAINT "bottle_kind_check" CHECK ("bottle_suggestion"."kind" in ('site','toy','art')),
	CONSTRAINT "bottle_text_check" CHECK (char_length("bottle_suggestion"."title") between 1 and 80 and char_length("bottle_suggestion"."note") between 1 and 80 and char_length("bottle_suggestion"."url") <= 2048)
);
--> statement-breakpoint
CREATE TABLE "bottle_usage" (
	"bucket" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"updated_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bottle_usage_count_check" CHECK ("bottle_usage"."count" between 0 and 5)
);
--> statement-breakpoint
CREATE INDEX "bottle_review_idx" ON "bottle_suggestion" USING btree ("status","id");