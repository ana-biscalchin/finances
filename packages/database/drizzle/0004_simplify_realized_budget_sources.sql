ALTER TABLE `budgets` ADD `account_id` text REFERENCES accounts(id);--> statement-breakpoint
CREATE INDEX `budgets_account_idx` ON `budgets` (`account_id`);--> statement-breakpoint
CREATE INDEX `budgets_source_idx` ON `budgets` (`budget_month`,`subcategory_id`,`account_id`,`payment_method_id`);--> statement-breakpoint
UPDATE `transactions` SET `status` = 'confirmed', `updated_at` = CURRENT_TIMESTAMP WHERE `status` = 'planned';
