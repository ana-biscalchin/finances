CREATE TABLE "account_payment_methods" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"payment_method_id" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"archived_at" text,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account_transfers" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"source_account_id" text NOT NULL,
	"destination_account_id" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"event_date" text NOT NULL,
	"description" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "account_transfers_positive_amount" CHECK ("account_transfers"."amount_cents" > 0),
	CONSTRAINT "account_transfers_distinct_accounts" CHECK ("account_transfers"."source_account_id" <> "account_transfers"."destination_account_id")
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"institution" text,
	"initial_balance_cents" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"nature" text NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"archived_at" text,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_card_bill_payments" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"bill_id" text NOT NULL,
	"account_id" text NOT NULL,
	"payment_transaction_id" text NOT NULL,
	"payment_date" text NOT NULL,
	"principal_cents" integer NOT NULL,
	"interest_cents" integer DEFAULT 0 NOT NULL,
	"penalty_cents" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"reversed_at" text,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "credit_card_bill_payments_positive_total" CHECK ("credit_card_bill_payments"."principal_cents" + "credit_card_bill_payments"."interest_cents" + "credit_card_bill_payments"."penalty_cents" > 0),
	CONSTRAINT "credit_card_bill_payments_nonnegative_principal" CHECK ("credit_card_bill_payments"."principal_cents" >= 0),
	CONSTRAINT "credit_card_bill_payments_nonnegative_interest" CHECK ("credit_card_bill_payments"."interest_cents" >= 0),
	CONSTRAINT "credit_card_bill_payments_nonnegative_penalty" CHECK ("credit_card_bill_payments"."penalty_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "credit_card_bills" (
	"id" text PRIMARY KEY NOT NULL,
	"credit_card_id" text NOT NULL,
	"bill_month" text NOT NULL,
	"closing_date" text,
	"due_date" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"paid_at" text,
	"minimum_due_cents" integer,
	"closed_at" text,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_cards" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"institution" text,
	"closing_day" integer NOT NULL,
	"due_day" integer NOT NULL,
	"payment_account_id" text,
	"limit_cents" integer,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "installment_purchases" (
	"id" text PRIMARY KEY NOT NULL,
	"credit_card_id" text NOT NULL,
	"original_description" text NOT NULL,
	"normalized_description" text NOT NULL,
	"original_event_date" text NOT NULL,
	"installment_count" integer NOT NULL,
	"total_amount_cents" integer,
	"source" text DEFAULT 'manual' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "installments" (
	"id" text PRIMARY KEY NOT NULL,
	"installment_purchase_id" text,
	"purchase_transaction_id" text NOT NULL,
	"credit_card_bill_id" text,
	"installment_number" integer NOT NULL,
	"installment_count" integer NOT NULL,
	"amount_cents" integer NOT NULL,
	"due_month" text NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_methods" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "planned_expenses" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"budget_month" text NOT NULL,
	"subcategory_id" text NOT NULL,
	"name" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"account_id" text,
	"credit_card_id" text,
	"recurrence_rule_id" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "planned_expenses_positive_amount" CHECK ("planned_expenses"."amount_cents" > 0),
	CONSTRAINT "planned_expenses_single_source" CHECK (("planned_expenses"."account_id" IS NOT NULL) <> ("planned_expenses"."credit_card_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "recurrence_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"kind" text NOT NULL,
	"description" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"subcategory_id" text NOT NULL,
	"account_id" text,
	"credit_card_id" text,
	"payment_method_id" text,
	"frequency" text DEFAULT 'monthly' NOT NULL,
	"day_of_month" integer NOT NULL,
	"start_month" text NOT NULL,
	"end_month" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "recurrence_rules_positive_amount" CHECK ("recurrence_rules"."amount_cents" > 0),
	CONSTRAINT "recurrence_rules_day_range" CHECK ("recurrence_rules"."day_of_month" BETWEEN 1 AND 31),
	CONSTRAINT "recurrence_rules_single_target" CHECK (("recurrence_rules"."account_id" IS NOT NULL) <> ("recurrence_rules"."credit_card_id" IS NOT NULL)),
	CONSTRAINT "recurrence_rules_card_without_payment_method" CHECK ("recurrence_rules"."credit_card_id" IS NULL OR "recurrence_rules"."payment_method_id" IS NULL)
);
--> statement-breakpoint
CREATE TABLE "reserve_goals" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"target_amount_cents" integer,
	"account_id" text,
	"target_date" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reserve_movements" (
	"id" text PRIMARY KEY NOT NULL,
	"reserve_goal_id" text NOT NULL,
	"type" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"movement_date" text NOT NULL,
	"notes" text,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" text NOT NULL,
	"last_seen_at" text NOT NULL,
	"revoked_at" text,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"owner_id" text NOT NULL,
	"key" text NOT NULL,
	"value" text,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "settings_owner_id_key_pk" PRIMARY KEY("owner_id","key")
);
--> statement-breakpoint
CREATE TABLE "subcategories" (
	"id" text PRIMARY KEY NOT NULL,
	"category_id" text NOT NULL,
	"name" text NOT NULL,
	"behavior" text DEFAULT 'variable' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"archived_at" text,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"type" text NOT NULL,
	"description" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"event_date" text NOT NULL,
	"budget_month" text NOT NULL,
	"account_id" text,
	"payment_method_id" text,
	"subcategory_id" text,
	"credit_card_id" text,
	"credit_card_bill_id" text,
	"status" text DEFAULT 'planned' NOT NULL,
	"notes" text,
	"transfer_id" text,
	"recurrence_rule_id" text,
	"recurrence_month" text,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "transactions_positive_amount" CHECK ("transactions"."amount_cents" > 0)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'owner' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"password_changed_at" text NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account_payment_methods" ADD CONSTRAINT "account_payment_methods_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_payment_methods" ADD CONSTRAINT "account_payment_methods_payment_method_id_payment_methods_id_fk" FOREIGN KEY ("payment_method_id") REFERENCES "public"."payment_methods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_transfers" ADD CONSTRAINT "account_transfers_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_transfers" ADD CONSTRAINT "account_transfers_source_account_id_accounts_id_fk" FOREIGN KEY ("source_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_transfers" ADD CONSTRAINT "account_transfers_destination_account_id_accounts_id_fk" FOREIGN KEY ("destination_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_card_bill_payments" ADD CONSTRAINT "credit_card_bill_payments_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_card_bill_payments" ADD CONSTRAINT "credit_card_bill_payments_bill_id_credit_card_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."credit_card_bills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_card_bill_payments" ADD CONSTRAINT "credit_card_bill_payments_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_card_bill_payments" ADD CONSTRAINT "credit_card_bill_payments_payment_transaction_id_transactions_id_fk" FOREIGN KEY ("payment_transaction_id") REFERENCES "public"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_card_bills" ADD CONSTRAINT "credit_card_bills_credit_card_id_credit_cards_id_fk" FOREIGN KEY ("credit_card_id") REFERENCES "public"."credit_cards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_cards" ADD CONSTRAINT "credit_cards_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_cards" ADD CONSTRAINT "credit_cards_payment_account_id_accounts_id_fk" FOREIGN KEY ("payment_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installment_purchases" ADD CONSTRAINT "installment_purchases_credit_card_id_credit_cards_id_fk" FOREIGN KEY ("credit_card_id") REFERENCES "public"."credit_cards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installments" ADD CONSTRAINT "installments_installment_purchase_id_installment_purchases_id_fk" FOREIGN KEY ("installment_purchase_id") REFERENCES "public"."installment_purchases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installments" ADD CONSTRAINT "installments_purchase_transaction_id_transactions_id_fk" FOREIGN KEY ("purchase_transaction_id") REFERENCES "public"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installments" ADD CONSTRAINT "installments_credit_card_bill_id_credit_card_bills_id_fk" FOREIGN KEY ("credit_card_bill_id") REFERENCES "public"."credit_card_bills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planned_expenses" ADD CONSTRAINT "planned_expenses_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planned_expenses" ADD CONSTRAINT "planned_expenses_subcategory_id_subcategories_id_fk" FOREIGN KEY ("subcategory_id") REFERENCES "public"."subcategories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planned_expenses" ADD CONSTRAINT "planned_expenses_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planned_expenses" ADD CONSTRAINT "planned_expenses_credit_card_id_credit_cards_id_fk" FOREIGN KEY ("credit_card_id") REFERENCES "public"."credit_cards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planned_expenses" ADD CONSTRAINT "planned_expenses_recurrence_rule_id_recurrence_rules_id_fk" FOREIGN KEY ("recurrence_rule_id") REFERENCES "public"."recurrence_rules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurrence_rules" ADD CONSTRAINT "recurrence_rules_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurrence_rules" ADD CONSTRAINT "recurrence_rules_subcategory_id_subcategories_id_fk" FOREIGN KEY ("subcategory_id") REFERENCES "public"."subcategories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurrence_rules" ADD CONSTRAINT "recurrence_rules_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurrence_rules" ADD CONSTRAINT "recurrence_rules_credit_card_id_credit_cards_id_fk" FOREIGN KEY ("credit_card_id") REFERENCES "public"."credit_cards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurrence_rules" ADD CONSTRAINT "recurrence_rules_payment_method_id_payment_methods_id_fk" FOREIGN KEY ("payment_method_id") REFERENCES "public"."payment_methods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reserve_goals" ADD CONSTRAINT "reserve_goals_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reserve_goals" ADD CONSTRAINT "reserve_goals_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reserve_movements" ADD CONSTRAINT "reserve_movements_reserve_goal_id_reserve_goals_id_fk" FOREIGN KEY ("reserve_goal_id") REFERENCES "public"."reserve_goals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subcategories" ADD CONSTRAINT "subcategories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_payment_method_id_payment_methods_id_fk" FOREIGN KEY ("payment_method_id") REFERENCES "public"."payment_methods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_subcategory_id_subcategories_id_fk" FOREIGN KEY ("subcategory_id") REFERENCES "public"."subcategories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_credit_card_id_credit_cards_id_fk" FOREIGN KEY ("credit_card_id") REFERENCES "public"."credit_cards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_credit_card_bill_id_credit_card_bills_id_fk" FOREIGN KEY ("credit_card_bill_id") REFERENCES "public"."credit_card_bills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_transfer_id_account_transfers_id_fk" FOREIGN KEY ("transfer_id") REFERENCES "public"."account_transfers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_recurrence_rule_id_recurrence_rules_id_fk" FOREIGN KEY ("recurrence_rule_id") REFERENCES "public"."recurrence_rules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "account_payment_methods_account_method_unique" ON "account_payment_methods" USING btree ("account_id","payment_method_id");--> statement-breakpoint
CREATE INDEX "account_payment_methods_account_active_idx" ON "account_payment_methods" USING btree ("account_id","is_active");--> statement-breakpoint
CREATE INDEX "account_transfers_owner_event_idx" ON "account_transfers" USING btree ("owner_id","event_date");--> statement-breakpoint
CREATE INDEX "account_transfers_source_idx" ON "account_transfers" USING btree ("source_account_id");--> statement-breakpoint
CREATE INDEX "account_transfers_destination_idx" ON "account_transfers" USING btree ("destination_account_id");--> statement-breakpoint
CREATE INDEX "account_transfers_event_date_idx" ON "account_transfers" USING btree ("event_date");--> statement-breakpoint
CREATE INDEX "accounts_owner_active_idx" ON "accounts" USING btree ("owner_id","is_active");--> statement-breakpoint
CREATE INDEX "accounts_owner_sort_idx" ON "accounts" USING btree ("owner_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_owner_nature_name_unique" ON "categories" USING btree ("owner_id","nature","name");--> statement-breakpoint
CREATE INDEX "categories_owner_nature_idx" ON "categories" USING btree ("owner_id","nature");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_card_bill_payments_owner_idempotency_unique" ON "credit_card_bill_payments" USING btree ("owner_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_card_bill_payments_transaction_unique" ON "credit_card_bill_payments" USING btree ("payment_transaction_id");--> statement-breakpoint
CREATE INDEX "credit_card_bill_payments_owner_bill_idx" ON "credit_card_bill_payments" USING btree ("owner_id","bill_id");--> statement-breakpoint
CREATE INDEX "credit_card_bill_payments_bill_idx" ON "credit_card_bill_payments" USING btree ("bill_id");--> statement-breakpoint
CREATE INDEX "credit_card_bill_payments_account_idx" ON "credit_card_bill_payments" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_card_bills_card_month_unique" ON "credit_card_bills" USING btree ("credit_card_id","bill_month");--> statement-breakpoint
CREATE INDEX "credit_card_bills_due_date_idx" ON "credit_card_bills" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "credit_cards_owner_active_idx" ON "credit_cards" USING btree ("owner_id","is_active");--> statement-breakpoint
CREATE INDEX "credit_cards_owner_default_idx" ON "credit_cards" USING btree ("owner_id","is_default");--> statement-breakpoint
CREATE INDEX "installment_purchases_card_idx" ON "installment_purchases" USING btree ("credit_card_id");--> statement-breakpoint
CREATE INDEX "installment_purchases_lookup_idx" ON "installment_purchases" USING btree ("credit_card_id","normalized_description","installment_count");--> statement-breakpoint
CREATE UNIQUE INDEX "installments_purchase_group_number_unique" ON "installments" USING btree ("installment_purchase_id","installment_number");--> statement-breakpoint
CREATE UNIQUE INDEX "installments_purchase_number_unique" ON "installments" USING btree ("purchase_transaction_id","installment_number");--> statement-breakpoint
CREATE INDEX "installments_due_month_idx" ON "installments" USING btree ("due_month");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_methods_name_unique" ON "payment_methods" USING btree ("name");--> statement-breakpoint
CREATE INDEX "planned_expenses_owner_month_idx" ON "planned_expenses" USING btree ("owner_id","budget_month");--> statement-breakpoint
CREATE INDEX "planned_expenses_month_subcategory_idx" ON "planned_expenses" USING btree ("budget_month","subcategory_id");--> statement-breakpoint
CREATE INDEX "planned_expenses_account_idx" ON "planned_expenses" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "planned_expenses_card_idx" ON "planned_expenses" USING btree ("credit_card_id");--> statement-breakpoint
CREATE INDEX "recurrence_rules_owner_status_idx" ON "recurrence_rules" USING btree ("owner_id","status");--> statement-breakpoint
CREATE INDEX "recurrence_rules_account_idx" ON "recurrence_rules" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "recurrence_rules_card_idx" ON "recurrence_rules" USING btree ("credit_card_id");--> statement-breakpoint
CREATE INDEX "recurrence_rules_status_idx" ON "recurrence_rules" USING btree ("status");--> statement-breakpoint
CREATE INDEX "reserve_goals_owner_status_idx" ON "reserve_goals" USING btree ("owner_id","status");--> statement-breakpoint
CREATE INDEX "reserve_movements_goal_idx" ON "reserve_movements" USING btree ("reserve_goal_id");--> statement-breakpoint
CREATE INDEX "reserve_movements_date_idx" ON "reserve_movements" USING btree ("movement_date");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_hash_unique" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expiration_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "sessions_active_user_idx" ON "sessions" USING btree ("user_id","revoked_at");--> statement-breakpoint
CREATE UNIQUE INDEX "subcategories_category_name_unique" ON "subcategories" USING btree ("category_id","name");--> statement-breakpoint
CREATE INDEX "subcategories_category_idx" ON "subcategories" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "transactions_owner_budget_month_idx" ON "transactions" USING btree ("owner_id","budget_month");--> statement-breakpoint
CREATE INDEX "transactions_owner_event_date_idx" ON "transactions" USING btree ("owner_id","event_date");--> statement-breakpoint
CREATE INDEX "transactions_budget_month_idx" ON "transactions" USING btree ("budget_month");--> statement-breakpoint
CREATE INDEX "transactions_budget_month_event_idx" ON "transactions" USING btree ("budget_month","event_date","description");--> statement-breakpoint
CREATE INDEX "transactions_budget_month_status_idx" ON "transactions" USING btree ("budget_month","status");--> statement-breakpoint
CREATE INDEX "transactions_event_date_idx" ON "transactions" USING btree ("event_date");--> statement-breakpoint
CREATE INDEX "transactions_event_date_status_idx" ON "transactions" USING btree ("event_date","status");--> statement-breakpoint
CREATE INDEX "transactions_subcategory_idx" ON "transactions" USING btree ("subcategory_id");--> statement-breakpoint
CREATE INDEX "transactions_account_idx" ON "transactions" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "transactions_credit_card_idx" ON "transactions" USING btree ("credit_card_id");--> statement-breakpoint
CREATE INDEX "transactions_credit_card_month_idx" ON "transactions" USING btree ("credit_card_id","budget_month");--> statement-breakpoint
CREATE INDEX "transactions_credit_card_bill_idx" ON "transactions" USING btree ("credit_card_bill_id");--> statement-breakpoint
CREATE INDEX "transactions_transfer_idx" ON "transactions" USING btree ("transfer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_owner_recurrence_month_unique" ON "transactions" USING btree ("owner_id","recurrence_rule_id","recurrence_month");--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_unique" ON "users" USING btree ("username");