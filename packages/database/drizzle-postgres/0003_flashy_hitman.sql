CREATE TABLE "monthly_income_plans" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"budget_month" text NOT NULL,
	"subcategory_id" text NOT NULL,
	"account_id" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "monthly_income_plans_positive_amount" CHECK ("monthly_income_plans"."amount_cents" > 0)
);
--> statement-breakpoint
ALTER TABLE "monthly_income_plans" ADD CONSTRAINT "monthly_income_plans_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_income_plans" ADD CONSTRAINT "monthly_income_plans_subcategory_id_subcategories_id_fk" FOREIGN KEY ("subcategory_id") REFERENCES "public"."subcategories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_income_plans" ADD CONSTRAINT "monthly_income_plans_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "monthly_income_plans_owner_month_key_unique" ON "monthly_income_plans" USING btree ("owner_id","budget_month","subcategory_id","account_id");--> statement-breakpoint
CREATE INDEX "monthly_income_plans_owner_month_idx" ON "monthly_income_plans" USING btree ("owner_id","budget_month");