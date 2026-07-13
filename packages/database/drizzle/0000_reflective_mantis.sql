CREATE TABLE `account_payment_methods` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`payment_method_id` text NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`archived_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`payment_method_id`) REFERENCES `payment_methods`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `account_payment_methods_account_method_unique` ON `account_payment_methods` (`account_id`,`payment_method_id`);--> statement-breakpoint
CREATE INDEX `account_payment_methods_account_active_idx` ON `account_payment_methods` (`account_id`,`is_active`);--> statement-breakpoint
CREATE TABLE `account_transfers` (
	`id` text PRIMARY KEY NOT NULL,
	`source_account_id` text NOT NULL,
	`destination_account_id` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`event_date` text NOT NULL,
	`description` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`source_account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`destination_account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "account_transfers_positive_amount" CHECK("account_transfers"."amount_cents" > 0),
	CONSTRAINT "account_transfers_distinct_accounts" CHECK("account_transfers"."source_account_id" <> "account_transfers"."destination_account_id")
);
--> statement-breakpoint
CREATE INDEX `account_transfers_source_idx` ON `account_transfers` (`source_account_id`);--> statement-breakpoint
CREATE INDEX `account_transfers_destination_idx` ON `account_transfers` (`destination_account_id`);--> statement-breakpoint
CREATE INDEX `account_transfers_event_date_idx` ON `account_transfers` (`event_date`);--> statement-breakpoint
CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`institution` text,
	`initial_balance_cents` integer DEFAULT 0 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_primary` integer DEFAULT false NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `budget_allocations` (
	`id` text PRIMARY KEY NOT NULL,
	`budget_id` text NOT NULL,
	`account_id` text,
	`credit_card_id` text,
	`amount_cents` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`budget_id`) REFERENCES `budgets`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`credit_card_id`) REFERENCES `credit_cards`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "budget_allocations_positive_amount" CHECK("budget_allocations"."amount_cents" > 0),
	CONSTRAINT "budget_allocations_single_source" CHECK(("budget_allocations"."account_id" IS NOT NULL) <> ("budget_allocations"."credit_card_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `budget_allocations_budget_account_unique` ON `budget_allocations` (`budget_id`,`account_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `budget_allocations_budget_card_unique` ON `budget_allocations` (`budget_id`,`credit_card_id`);--> statement-breakpoint
CREATE INDEX `budget_allocations_account_idx` ON `budget_allocations` (`account_id`);--> statement-breakpoint
CREATE INDEX `budget_allocations_card_idx` ON `budget_allocations` (`credit_card_id`);--> statement-breakpoint
CREATE TABLE `budgets` (
	`id` text PRIMARY KEY NOT NULL,
	`budget_month` text NOT NULL,
	`subcategory_id` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`subcategory_id`) REFERENCES `subcategories`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "budgets_positive_amount" CHECK("budgets"."amount_cents" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `budgets_month_subcategory_unique` ON `budgets` (`budget_month`,`subcategory_id`);--> statement-breakpoint
CREATE INDEX `budgets_subcategory_idx` ON `budgets` (`subcategory_id`);--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`nature` text NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`archived_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_nature_name_unique` ON `categories` (`nature`,`name`);--> statement-breakpoint
CREATE INDEX `categories_nature_idx` ON `categories` (`nature`);--> statement-breakpoint
CREATE TABLE `credit_card_bill_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`idempotency_key` text NOT NULL,
	`bill_id` text NOT NULL,
	`account_id` text NOT NULL,
	`payment_transaction_id` text NOT NULL,
	`payment_date` text NOT NULL,
	`principal_cents` integer NOT NULL,
	`interest_cents` integer DEFAULT 0 NOT NULL,
	`penalty_cents` integer DEFAULT 0 NOT NULL,
	`notes` text,
	`reversed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`bill_id`) REFERENCES `credit_card_bills`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`payment_transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "credit_card_bill_payments_positive_total" CHECK("credit_card_bill_payments"."principal_cents" + "credit_card_bill_payments"."interest_cents" + "credit_card_bill_payments"."penalty_cents" > 0),
	CONSTRAINT "credit_card_bill_payments_nonnegative_principal" CHECK("credit_card_bill_payments"."principal_cents" >= 0),
	CONSTRAINT "credit_card_bill_payments_nonnegative_interest" CHECK("credit_card_bill_payments"."interest_cents" >= 0),
	CONSTRAINT "credit_card_bill_payments_nonnegative_penalty" CHECK("credit_card_bill_payments"."penalty_cents" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `credit_card_bill_payments_idempotency_unique` ON `credit_card_bill_payments` (`idempotency_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `credit_card_bill_payments_transaction_unique` ON `credit_card_bill_payments` (`payment_transaction_id`);--> statement-breakpoint
CREATE INDEX `credit_card_bill_payments_bill_idx` ON `credit_card_bill_payments` (`bill_id`);--> statement-breakpoint
CREATE INDEX `credit_card_bill_payments_account_idx` ON `credit_card_bill_payments` (`account_id`);--> statement-breakpoint
CREATE TABLE `credit_card_bills` (
	`id` text PRIMARY KEY NOT NULL,
	`credit_card_id` text NOT NULL,
	`bill_month` text NOT NULL,
	`closing_date` text,
	`due_date` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`paid_at` text,
	`minimum_due_cents` integer,
	`closed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`credit_card_id`) REFERENCES `credit_cards`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `credit_card_bills_card_month_unique` ON `credit_card_bills` (`credit_card_id`,`bill_month`);--> statement-breakpoint
CREATE INDEX `credit_card_bills_due_date_idx` ON `credit_card_bills` (`due_date`);--> statement-breakpoint
CREATE TABLE `credit_cards` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`institution` text,
	`closing_day` integer NOT NULL,
	`due_day` integer NOT NULL,
	`payment_account_id` text,
	`limit_cents` integer,
	`is_default` integer DEFAULT false NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`payment_account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `installment_purchases` (
	`id` text PRIMARY KEY NOT NULL,
	`credit_card_id` text NOT NULL,
	`original_description` text NOT NULL,
	`normalized_description` text NOT NULL,
	`original_event_date` text NOT NULL,
	`installment_count` integer NOT NULL,
	`total_amount_cents` integer,
	`source` text DEFAULT 'manual' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`credit_card_id`) REFERENCES `credit_cards`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `installment_purchases_card_idx` ON `installment_purchases` (`credit_card_id`);--> statement-breakpoint
CREATE INDEX `installment_purchases_lookup_idx` ON `installment_purchases` (`credit_card_id`,`normalized_description`,`installment_count`);--> statement-breakpoint
CREATE TABLE `installments` (
	`id` text PRIMARY KEY NOT NULL,
	`installment_purchase_id` text,
	`purchase_transaction_id` text NOT NULL,
	`credit_card_bill_id` text,
	`installment_number` integer NOT NULL,
	`installment_count` integer NOT NULL,
	`amount_cents` integer NOT NULL,
	`due_month` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`installment_purchase_id`) REFERENCES `installment_purchases`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`purchase_transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`credit_card_bill_id`) REFERENCES `credit_card_bills`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `installments_purchase_group_number_unique` ON `installments` (`installment_purchase_id`,`installment_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `installments_purchase_number_unique` ON `installments` (`purchase_transaction_id`,`installment_number`);--> statement-breakpoint
CREATE INDEX `installments_due_month_idx` ON `installments` (`due_month`);--> statement-breakpoint
CREATE TABLE `payment_methods` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payment_methods_name_unique` ON `payment_methods` (`name`);--> statement-breakpoint
CREATE TABLE `planned_expenses` (
	`id` text PRIMARY KEY NOT NULL,
	`budget_month` text NOT NULL,
	`subcategory_id` text NOT NULL,
	`name` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`account_id` text,
	`credit_card_id` text,
	`recurrence_rule_id` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`subcategory_id`) REFERENCES `subcategories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`credit_card_id`) REFERENCES `credit_cards`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`recurrence_rule_id`) REFERENCES `recurrence_rules`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "planned_expenses_positive_amount" CHECK("planned_expenses"."amount_cents" > 0),
	CONSTRAINT "planned_expenses_single_source" CHECK(("planned_expenses"."account_id" IS NOT NULL) <> ("planned_expenses"."credit_card_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX `planned_expenses_month_subcategory_idx` ON `planned_expenses` (`budget_month`,`subcategory_id`);--> statement-breakpoint
CREATE INDEX `planned_expenses_account_idx` ON `planned_expenses` (`account_id`);--> statement-breakpoint
CREATE INDEX `planned_expenses_card_idx` ON `planned_expenses` (`credit_card_id`);--> statement-breakpoint
CREATE TABLE `recurrence_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`description` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`subcategory_id` text NOT NULL,
	`account_id` text,
	`credit_card_id` text,
	`payment_method_id` text,
	`frequency` text DEFAULT 'monthly' NOT NULL,
	`day_of_month` integer NOT NULL,
	`start_month` text NOT NULL,
	`end_month` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`subcategory_id`) REFERENCES `subcategories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`credit_card_id`) REFERENCES `credit_cards`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`payment_method_id`) REFERENCES `payment_methods`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "recurrence_rules_positive_amount" CHECK("recurrence_rules"."amount_cents" > 0),
	CONSTRAINT "recurrence_rules_day_range" CHECK("recurrence_rules"."day_of_month" BETWEEN 1 AND 31),
	CONSTRAINT "recurrence_rules_single_target" CHECK(("recurrence_rules"."account_id" IS NOT NULL) <> ("recurrence_rules"."credit_card_id" IS NOT NULL)),
	CONSTRAINT "recurrence_rules_card_without_payment_method" CHECK("recurrence_rules"."credit_card_id" IS NULL OR "recurrence_rules"."payment_method_id" IS NULL)
);
--> statement-breakpoint
CREATE INDEX `recurrence_rules_account_idx` ON `recurrence_rules` (`account_id`);--> statement-breakpoint
CREATE INDEX `recurrence_rules_card_idx` ON `recurrence_rules` (`credit_card_id`);--> statement-breakpoint
CREATE INDEX `recurrence_rules_status_idx` ON `recurrence_rules` (`status`);--> statement-breakpoint
CREATE TABLE `reserve_goals` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`target_amount_cents` integer,
	`account_id` text,
	`target_date` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `reserve_movements` (
	`id` text PRIMARY KEY NOT NULL,
	`reserve_goal_id` text NOT NULL,
	`type` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`movement_date` text NOT NULL,
	`notes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`reserve_goal_id`) REFERENCES `reserve_goals`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `reserve_movements_goal_idx` ON `reserve_movements` (`reserve_goal_id`);--> statement-breakpoint
CREATE INDEX `reserve_movements_date_idx` ON `reserve_movements` (`movement_date`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `subcategories` (
	`id` text PRIMARY KEY NOT NULL,
	`category_id` text NOT NULL,
	`name` text NOT NULL,
	`behavior` text DEFAULT 'variable' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`archived_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subcategories_category_name_unique` ON `subcategories` (`category_id`,`name`);--> statement-breakpoint
CREATE INDEX `subcategories_category_idx` ON `subcategories` (`category_id`);--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`description` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`event_date` text NOT NULL,
	`budget_month` text NOT NULL,
	`account_id` text,
	`payment_method_id` text,
	`subcategory_id` text,
	`credit_card_id` text,
	`credit_card_bill_id` text,
	`status` text DEFAULT 'planned' NOT NULL,
	`notes` text,
	`transfer_id` text,
	`recurrence_rule_id` text,
	`recurrence_month` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`payment_method_id`) REFERENCES `payment_methods`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`subcategory_id`) REFERENCES `subcategories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`credit_card_id`) REFERENCES `credit_cards`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`credit_card_bill_id`) REFERENCES `credit_card_bills`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`transfer_id`) REFERENCES `account_transfers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`recurrence_rule_id`) REFERENCES `recurrence_rules`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "transactions_positive_amount" CHECK("transactions"."amount_cents" > 0)
);
--> statement-breakpoint
CREATE INDEX `transactions_budget_month_idx` ON `transactions` (`budget_month`);--> statement-breakpoint
CREATE INDEX `transactions_budget_month_event_idx` ON `transactions` (`budget_month`,`event_date`,`description`);--> statement-breakpoint
CREATE INDEX `transactions_budget_month_status_idx` ON `transactions` (`budget_month`,`status`);--> statement-breakpoint
CREATE INDEX `transactions_event_date_idx` ON `transactions` (`event_date`);--> statement-breakpoint
CREATE INDEX `transactions_event_date_status_idx` ON `transactions` (`event_date`,`status`);--> statement-breakpoint
CREATE INDEX `transactions_subcategory_idx` ON `transactions` (`subcategory_id`);--> statement-breakpoint
CREATE INDEX `transactions_account_idx` ON `transactions` (`account_id`);--> statement-breakpoint
CREATE INDEX `transactions_credit_card_idx` ON `transactions` (`credit_card_id`);--> statement-breakpoint
CREATE INDEX `transactions_credit_card_month_idx` ON `transactions` (`credit_card_id`,`budget_month`);--> statement-breakpoint
CREATE INDEX `transactions_credit_card_bill_idx` ON `transactions` (`credit_card_bill_id`);--> statement-breakpoint
CREATE INDEX `transactions_transfer_idx` ON `transactions` (`transfer_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `transactions_recurrence_month_unique` ON `transactions` (`recurrence_rule_id`,`recurrence_month`);