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
CREATE TABLE `credit_card_bill_payments` (
	`id` text PRIMARY KEY NOT NULL,
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
CREATE UNIQUE INDEX `credit_card_bill_payments_transaction_unique` ON `credit_card_bill_payments` (`payment_transaction_id`);--> statement-breakpoint
CREATE INDEX `credit_card_bill_payments_bill_idx` ON `credit_card_bill_payments` (`bill_id`);--> statement-breakpoint
CREATE INDEX `credit_card_bill_payments_account_idx` ON `credit_card_bill_payments` (`account_id`);--> statement-breakpoint
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
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_budgets` (
	`id` text PRIMARY KEY NOT NULL,
	`budget_month` text NOT NULL,
	`subcategory_id` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`subcategory_id`) REFERENCES `subcategories`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "budgets_positive_amount" CHECK("__new_budgets"."amount_cents" > 0)
);
--> statement-breakpoint
INSERT INTO `__new_budgets`("id", "budget_month", "subcategory_id", "amount_cents", "created_at", "updated_at")
SELECT MIN("id"), "budget_month", "subcategory_id", SUM("amount_cents"), MIN("created_at"), MAX("updated_at")
FROM `budgets`
WHERE "subcategory_id" IS NOT NULL
  AND "account_id" IS NULL
  AND "payment_method_id" IS NULL
  AND "amount_cents" > 0
GROUP BY "budget_month", "subcategory_id";--> statement-breakpoint
DROP TABLE `budgets`;--> statement-breakpoint
ALTER TABLE `__new_budgets` RENAME TO `budgets`;--> statement-breakpoint
CREATE UNIQUE INDEX `budgets_month_subcategory_unique` ON `budgets` (`budget_month`,`subcategory_id`);--> statement-breakpoint
CREATE INDEX `budgets_subcategory_idx` ON `budgets` (`subcategory_id`);--> statement-breakpoint
ALTER TABLE `credit_card_bills` ADD `minimum_due_cents` integer;--> statement-breakpoint
ALTER TABLE `credit_card_bills` ADD `closed_at` text;--> statement-breakpoint
CREATE TABLE `__new_transactions` (
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
	CONSTRAINT "transactions_positive_amount" CHECK("__new_transactions"."amount_cents" > 0)
);
--> statement-breakpoint
INSERT INTO `__new_transactions`("id", "type", "description", "amount_cents", "event_date", "budget_month", "account_id", "payment_method_id", "subcategory_id", "credit_card_id", "credit_card_bill_id", "status", "notes", "transfer_id", "recurrence_rule_id", "recurrence_month", "created_at", "updated_at")
SELECT "id", "type", "description", "amount_cents", "event_date", "budget_month", "account_id", "payment_method_id", "subcategory_id", "credit_card_id", "credit_card_bill_id", "status", "notes", NULL, NULL, NULL, "created_at", "updated_at"
FROM `transactions`
WHERE "amount_cents" > 0;--> statement-breakpoint
DROP TABLE `transactions`;--> statement-breakpoint
ALTER TABLE `__new_transactions` RENAME TO `transactions`;--> statement-breakpoint
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
CREATE UNIQUE INDEX `transactions_recurrence_month_unique` ON `transactions` (`recurrence_rule_id`,`recurrence_month`);--> statement-breakpoint
PRAGMA foreign_keys=ON;
