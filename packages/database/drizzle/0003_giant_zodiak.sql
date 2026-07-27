PRAGMA defer_foreign_keys = ON;--> statement-breakpoint
PRAGMA foreign_keys = OFF;--> statement-breakpoint
CREATE TABLE `__new_accounts` (
  `id` text PRIMARY KEY NOT NULL,
  `owner_id` text NOT NULL,
  `name` text NOT NULL,
  `type` text NOT NULL,
  `institution` text,
  `initial_balance_cents` integer DEFAULT 0 NOT NULL,
  `sort_order` integer DEFAULT 0 NOT NULL,
  `is_primary` integer DEFAULT false NOT NULL,
  `is_active` integer DEFAULT true NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
INSERT INTO `__new_accounts` (`id`, `owner_id`, `name`, `type`, `institution`, `initial_balance_cents`, `sort_order`, `is_primary`, `is_active`, `created_at`, `updated_at`)
SELECT `id`, (SELECT `id` FROM `users` WHERE `username` = migration_owner_username()), `name`, `type`, `institution`, `initial_balance_cents`, `sort_order`, `is_primary`, `is_active`, `created_at`, `updated_at`
FROM `accounts`;--> statement-breakpoint
DROP TABLE `accounts`;--> statement-breakpoint
ALTER TABLE `__new_accounts` RENAME TO `accounts`;--> statement-breakpoint
CREATE INDEX `accounts_owner_active_idx` ON `accounts` (`owner_id`,`is_active`);--> statement-breakpoint
CREATE INDEX `accounts_owner_sort_idx` ON `accounts` (`owner_id`,`sort_order`);--> statement-breakpoint
PRAGMA foreign_keys = ON;