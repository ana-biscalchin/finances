PRAGMA defer_foreign_keys = ON;--> statement-breakpoint
PRAGMA foreign_keys = OFF;--> statement-breakpoint
CREATE TABLE `__new_credit_cards` (
  `id` text PRIMARY KEY NOT NULL,
  `owner_id` text NOT NULL,
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
  FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`payment_account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
INSERT INTO `__new_credit_cards` (`id`, `owner_id`, `name`, `institution`, `closing_day`, `due_day`, `payment_account_id`, `limit_cents`, `is_default`, `is_active`, `created_at`, `updated_at`)
SELECT `id`, (SELECT `id` FROM `users` WHERE `username` = migration_owner_username()), `name`, `institution`, `closing_day`, `due_day`, `payment_account_id`, `limit_cents`, `is_default`, `is_active`, `created_at`, `updated_at`
FROM `credit_cards`;--> statement-breakpoint
DROP TABLE `credit_cards`;--> statement-breakpoint
ALTER TABLE `__new_credit_cards` RENAME TO `credit_cards`;--> statement-breakpoint
CREATE INDEX `credit_cards_owner_active_idx` ON `credit_cards` (`owner_id`,`is_active`);--> statement-breakpoint
CREATE INDEX `credit_cards_owner_default_idx` ON `credit_cards` (`owner_id`,`is_default`);--> statement-breakpoint
PRAGMA foreign_keys = ON;