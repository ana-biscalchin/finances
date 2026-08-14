CREATE TABLE "monthly_budget_allocations" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"budget_month" text NOT NULL,
	"subcategory_id" text NOT NULL,
	"account_id" text,
	"payment_method_id" text,
	"credit_card_id" text,
	"amount_cents" integer NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "monthly_budget_allocations_positive_amount" CHECK ("monthly_budget_allocations"."amount_cents" > 0),
	CONSTRAINT "monthly_budget_allocations_single_source" CHECK ((("monthly_budget_allocations"."account_id" IS NOT NULL AND "monthly_budget_allocations"."payment_method_id" IS NOT NULL AND "monthly_budget_allocations"."credit_card_id" IS NULL) OR ("monthly_budget_allocations"."account_id" IS NULL AND "monthly_budget_allocations"."payment_method_id" IS NULL AND "monthly_budget_allocations"."credit_card_id" IS NOT NULL)))
);
--> statement-breakpoint
ALTER TABLE "monthly_budget_allocations" ADD CONSTRAINT "monthly_budget_allocations_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_budget_allocations" ADD CONSTRAINT "monthly_budget_allocations_subcategory_id_subcategories_id_fk" FOREIGN KEY ("subcategory_id") REFERENCES "public"."subcategories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_budget_allocations" ADD CONSTRAINT "monthly_budget_allocations_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_budget_allocations" ADD CONSTRAINT "monthly_budget_allocations_payment_method_id_payment_methods_id_fk" FOREIGN KEY ("payment_method_id") REFERENCES "public"."payment_methods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_budget_allocations" ADD CONSTRAINT "monthly_budget_allocations_credit_card_id_credit_cards_id_fk" FOREIGN KEY ("credit_card_id") REFERENCES "public"."credit_cards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "monthly_budget_allocations_account_method_unique" ON "monthly_budget_allocations" USING btree ("owner_id","budget_month","subcategory_id","account_id","payment_method_id");--> statement-breakpoint
CREATE UNIQUE INDEX "monthly_budget_allocations_card_unique" ON "monthly_budget_allocations" USING btree ("owner_id","budget_month","subcategory_id","credit_card_id");--> statement-breakpoint
CREATE INDEX "monthly_budget_allocations_owner_month_idx" ON "monthly_budget_allocations" USING btree ("owner_id","budget_month");--> statement-breakpoint
CREATE INDEX "monthly_budget_allocations_account_method_idx" ON "monthly_budget_allocations" USING btree ("account_id","payment_method_id");--> statement-breakpoint
CREATE INDEX "monthly_budget_allocations_card_idx" ON "monthly_budget_allocations" USING btree ("credit_card_id");