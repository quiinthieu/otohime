CREATE TABLE "ask_usage" (
	"bucket" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
