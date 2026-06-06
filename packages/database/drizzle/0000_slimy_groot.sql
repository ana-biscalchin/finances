CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`institution` text,
	`initial_balance_cents` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `budgets` (
	`id` text PRIMARY KEY NOT NULL,
	`budget_month` text NOT NULL,
	`category_group_id` text,
	`category_macro_id` text,
	`category_micro_id` text,
	`payment_method_id` text,
	`amount_cents` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`category_group_id`) REFERENCES `category_groups`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_macro_id`) REFERENCES `category_macros`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_micro_id`) REFERENCES `category_micros`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`payment_method_id`) REFERENCES `payment_methods`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `budgets_month_idx` ON `budgets` (`budget_month`);--> statement-breakpoint
CREATE INDEX `budgets_category_micro_idx` ON `budgets` (`category_micro_id`);--> statement-breakpoint
CREATE TABLE `category_groups` (
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
CREATE UNIQUE INDEX `category_groups_nature_name_unique` ON `category_groups` (`nature`,`name`);--> statement-breakpoint
CREATE INDEX `category_groups_nature_idx` ON `category_groups` (`nature`);--> statement-breakpoint
CREATE TABLE `category_macros` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`archived_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `category_groups`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `category_macros_group_name_unique` ON `category_macros` (`group_id`,`name`);--> statement-breakpoint
CREATE INDEX `category_macros_group_idx` ON `category_macros` (`group_id`);--> statement-breakpoint
CREATE TABLE `category_micros` (
	`id` text PRIMARY KEY NOT NULL,
	`macro_id` text NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`archived_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`macro_id`) REFERENCES `category_macros`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `category_micros_macro_name_unique` ON `category_micros` (`macro_id`,`name`);--> statement-breakpoint
CREATE INDEX `category_micros_macro_idx` ON `category_micros` (`macro_id`);--> statement-breakpoint
CREATE TABLE `credit_card_bills` (
	`id` text PRIMARY KEY NOT NULL,
	`credit_card_id` text NOT NULL,
	`bill_month` text NOT NULL,
	`closing_date` text,
	`due_date` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`paid_at` text,
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
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`payment_account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `installments` (
	`id` text PRIMARY KEY NOT NULL,
	`purchase_transaction_id` text NOT NULL,
	`credit_card_bill_id` text,
	`installment_number` integer NOT NULL,
	`installment_count` integer NOT NULL,
	`amount_cents` integer NOT NULL,
	`due_month` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`purchase_transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`credit_card_bill_id`) REFERENCES `credit_card_bills`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
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
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`description` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`event_date` text NOT NULL,
	`budget_month` text NOT NULL,
	`account_id` text,
	`payment_method_id` text,
	`category_micro_id` text,
	`credit_card_id` text,
	`credit_card_bill_id` text,
	`status` text DEFAULT 'planned' NOT NULL,
	`notes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`payment_method_id`) REFERENCES `payment_methods`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_micro_id`) REFERENCES `category_micros`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`credit_card_id`) REFERENCES `credit_cards`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`credit_card_bill_id`) REFERENCES `credit_card_bills`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `transactions_budget_month_idx` ON `transactions` (`budget_month`);--> statement-breakpoint
CREATE INDEX `transactions_event_date_idx` ON `transactions` (`event_date`);--> statement-breakpoint
CREATE INDEX `transactions_category_micro_idx` ON `transactions` (`category_micro_id`);--> statement-breakpoint
CREATE TABLE `transfers` (
	`id` text PRIMARY KEY NOT NULL,
	`from_account_id` text NOT NULL,
	`to_account_id` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`transfer_date` text NOT NULL,
	`payment_method_id` text,
	`status` text DEFAULT 'planned' NOT NULL,
	`notes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`from_account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`to_account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`payment_method_id`) REFERENCES `payment_methods`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `transfers_from_account_idx` ON `transfers` (`from_account_id`);--> statement-breakpoint
CREATE INDEX `transfers_to_account_idx` ON `transfers` (`to_account_id`);--> statement-breakpoint
CREATE INDEX `transfers_date_idx` ON `transfers` (`transfer_date`);