CREATE TABLE "kintsugi_card" (
	"id" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"seams" jsonb NOT NULL,
	CONSTRAINT "kintsugi_count_check" CHECK ("kintsugi_card"."count" between 1 and 1000000),
	CONSTRAINT "kintsugi_seams_check" CHECK (jsonb_typeof("kintsugi_card"."seams") = 'array' and jsonb_array_length("kintsugi_card"."seams") <= 12)
);
--> statement-breakpoint
CREATE TABLE "kintsugi_usage" (
	"bucket" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "kintsugi_usage_count_check" CHECK ("kintsugi_usage"."count" between 0 and 1000)
);
