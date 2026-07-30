PRAGMA defer_foreign_keys = ON;--> statement-breakpoint
PRAGMA foreign_keys = OFF;--> statement-breakpoint
DROP INDEX `transactions_recurrence_month_unique`;--> statement-breakpoint
CREATE TABLE `__new_transactions` (
  `id` text PRIMARY KEY NOT NULL, `owner_id` text NOT NULL, `type` text NOT NULL, `description` text NOT NULL, `amount_cents` integer NOT NULL, `event_date` text NOT NULL, `budget_month` text NOT NULL,
  `account_id` text, `payment_method_id` text, `subcategory_id` text, `credit_card_id` text, `credit_card_bill_id` text, `status` text DEFAULT 'planned' NOT NULL, `notes` text, `transfer_id` text, `recurrence_rule_id` text, `recurrence_month` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL, `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action, FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action, FOREIGN KEY (`payment_method_id`) REFERENCES `payment_methods`(`id`) ON UPDATE no action ON DELETE no action, FOREIGN KEY (`subcategory_id`) REFERENCES `subcategories`(`id`) ON UPDATE no action ON DELETE no action, FOREIGN KEY (`credit_card_id`) REFERENCES `credit_cards`(`id`) ON UPDATE no action ON DELETE no action, FOREIGN KEY (`credit_card_bill_id`) REFERENCES `credit_card_bills`(`id`) ON UPDATE no action ON DELETE no action, FOREIGN KEY (`transfer_id`) REFERENCES `account_transfers`(`id`) ON UPDATE no action ON DELETE no action, FOREIGN KEY (`recurrence_rule_id`) REFERENCES `recurrence_rules`(`id`) ON UPDATE no action ON DELETE no action,
  CONSTRAINT "transactions_positive_amount" CHECK("__new_transactions"."amount_cents" > 0)
);--> statement-breakpoint
INSERT INTO `__new_transactions` (`id`,`owner_id`,`type`,`description`,`amount_cents`,`event_date`,`budget_month`,`account_id`,`payment_method_id`,`subcategory_id`,`credit_card_id`,`credit_card_bill_id`,`status`,`notes`,`transfer_id`,`recurrence_rule_id`,`recurrence_month`,`created_at`,`updated_at`) SELECT `id`,(SELECT `id` FROM `users` WHERE `username` = migration_owner_username()),`type`,`description`,`amount_cents`,`event_date`,`budget_month`,`account_id`,`payment_method_id`,`subcategory_id`,`credit_card_id`,`credit_card_bill_id`,`status`,`notes`,`transfer_id`,`recurrence_rule_id`,`recurrence_month`,`created_at`,`updated_at` FROM `transactions`;--> statement-breakpoint
DROP TABLE `transactions`;--> statement-breakpoint
ALTER TABLE `__new_transactions` RENAME TO `transactions`;--> statement-breakpoint
CREATE INDEX `transactions_owner_budget_month_idx` ON `transactions` (`owner_id`,`budget_month`);--> statement-breakpoint
CREATE INDEX `transactions_owner_event_date_idx` ON `transactions` (`owner_id`,`event_date`);--> statement-breakpoint
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
CREATE UNIQUE INDEX `transactions_owner_recurrence_month_unique` ON `transactions` (`owner_id`,`recurrence_rule_id`,`recurrence_month`);--> statement-breakpoint
PRAGMA foreign_keys = ON;