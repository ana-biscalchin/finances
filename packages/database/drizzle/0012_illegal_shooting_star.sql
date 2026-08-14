CREATE TABLE `monthly_income_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`budget_month` text NOT NULL,
	`subcategory_id` text NOT NULL,
	`account_id` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`subcategory_id`) REFERENCES `subcategories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "monthly_income_plans_positive_amount" CHECK("monthly_income_plans"."amount_cents" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `monthly_income_plans_owner_month_key_unique` ON `monthly_income_plans` (`owner_id`,`budget_month`,`subcategory_id`,`account_id`);--> statement-breakpoint
CREATE INDEX `monthly_income_plans_owner_month_idx` ON `monthly_income_plans` (`owner_id`,`budget_month`);