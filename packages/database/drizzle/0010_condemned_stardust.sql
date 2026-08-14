CREATE TABLE `monthly_budget_allocations` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`budget_month` text NOT NULL,
	`subcategory_id` text NOT NULL,
	`account_id` text,
	`payment_method_id` text,
	`credit_card_id` text,
	`amount_cents` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`subcategory_id`) REFERENCES `subcategories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`payment_method_id`) REFERENCES `payment_methods`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`credit_card_id`) REFERENCES `credit_cards`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "monthly_budget_allocations_positive_amount" CHECK("monthly_budget_allocations"."amount_cents" > 0),
	CONSTRAINT "monthly_budget_allocations_single_source" CHECK((("monthly_budget_allocations"."account_id" IS NOT NULL AND "monthly_budget_allocations"."payment_method_id" IS NOT NULL AND "monthly_budget_allocations"."credit_card_id" IS NULL) OR ("monthly_budget_allocations"."account_id" IS NULL AND "monthly_budget_allocations"."payment_method_id" IS NULL AND "monthly_budget_allocations"."credit_card_id" IS NOT NULL)))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `monthly_budget_allocations_account_method_unique` ON `monthly_budget_allocations` (`owner_id`,`budget_month`,`subcategory_id`,`account_id`,`payment_method_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `monthly_budget_allocations_card_unique` ON `monthly_budget_allocations` (`owner_id`,`budget_month`,`subcategory_id`,`credit_card_id`);--> statement-breakpoint
CREATE INDEX `monthly_budget_allocations_owner_month_idx` ON `monthly_budget_allocations` (`owner_id`,`budget_month`);--> statement-breakpoint
CREATE INDEX `monthly_budget_allocations_account_method_idx` ON `monthly_budget_allocations` (`account_id`,`payment_method_id`);--> statement-breakpoint
CREATE INDEX `monthly_budget_allocations_card_idx` ON `monthly_budget_allocations` (`credit_card_id`);