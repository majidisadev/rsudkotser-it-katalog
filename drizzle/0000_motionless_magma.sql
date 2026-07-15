CREATE TYPE "public"."loan_status" AS ENUM('PENDING', 'RESERVED', 'ACTIVE', 'RETURNED', 'REJECTED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."loan_type" AS ENUM('DIRECT', 'BOOKING');--> statement-breakpoint
CREATE TYPE "public"."proof_kind" AS ENUM('CHECKOUT', 'PICKUP', 'RETURN');--> statement-breakpoint
CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "item_variants" (
	"id" serial PRIMARY KEY NOT NULL,
	"item_id" integer NOT NULL,
	"name" text NOT NULL,
	"stock_total" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category_id" integer,
	"description" text,
	"photo_key" text,
	"photo_url" text,
	"asset_no" text,
	"has_variants" boolean DEFAULT false NOT NULL,
	"stock_total" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loan_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"loan_id" integer NOT NULL,
	"item_id" integer NOT NULL,
	"variant_id" integer,
	"quantity" integer NOT NULL,
	"quantity_returned" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loan_proofs" (
	"id" serial PRIMARY KEY NOT NULL,
	"loan_id" integer NOT NULL,
	"storage_key" text NOT NULL,
	"mime" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"kind" "proof_kind" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loans" (
	"id" serial PRIMARY KEY NOT NULL,
	"borrower_name" text NOT NULL,
	"borrower_unit" text NOT NULL,
	"type" "loan_type" NOT NULL,
	"status" "loan_status" NOT NULL,
	"planned_date" date,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone,
	"activated_at" timestamp with time zone,
	"returned_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"message" text NOT NULL,
	"loan_id" integer,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "item_variants" ADD CONSTRAINT "item_variants_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_items" ADD CONSTRAINT "loan_items_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_items" ADD CONSTRAINT "loan_items_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_items" ADD CONSTRAINT "loan_items_variant_id_item_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."item_variants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_proofs" ADD CONSTRAINT "loan_proofs_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "item_variants_item_id_idx" ON "item_variants" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "items_category_id_idx" ON "items" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "loan_items_item_id_idx" ON "loan_items" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "loan_items_variant_id_idx" ON "loan_items" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "loan_items_loan_id_idx" ON "loan_items" USING btree ("loan_id");--> statement-breakpoint
CREATE INDEX "loans_status_idx" ON "loans" USING btree ("status");--> statement-breakpoint
CREATE INDEX "loans_created_at_idx" ON "loans" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "loans_planned_date_idx" ON "loans" USING btree ("planned_date");--> statement-breakpoint
CREATE INDEX "notifications_unread_idx" ON "notifications" USING btree ("is_read","created_at");