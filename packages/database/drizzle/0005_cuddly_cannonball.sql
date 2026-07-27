PRAGMA defer_foreign_keys = ON;--> statement-breakpoint
PRAGMA foreign_keys = OFF;--> statement-breakpoint
CREATE TABLE `__new_account_transfers` (
  `id` text PRIMARY KEY NOT NULL,
  `owner_id` text NOT NULL,
  `source_account_id` text NOT NULL,
  `destination_account_id` text NOT NULL,
  `amount_cents` integer NOT NULL,
  `event_date` text NOT NULL,
  `description` text NOT NULL,
  `status` text DEFAULT 'active' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`source_account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`destination_account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
  CONSTRAINT "account_transfers_positive_amount" CHECK("__new_account_transfers"."amount_cents" > 0),
  CONSTRAINT "account_transfers_distinct_accounts" CHECK("__new_account_transfers"."source_account_id" <> "__new_account_transfers"."destination_account_id")
);--> statement-breakpoint
INSERT INTO `__new_account_transfers` (`id`, `owner_id`, `source_account_id`, `destination_account_id`, `amount_cents`, `event_date`, `description`, `status`, `created_at`, `updated_at`)
SELECT `id`, (SELECT `id` FROM `users` WHERE `username` = migration_owner_username()), `source_account_id`, `destination_account_id`, `amount_cents`, `event_date`, `description`, `status`, `created_at`, `updated_at`
FROM `account_transfers`;--> statement-breakpoint
DROP TABLE `account_transfers`;--> statement-breakpoint
ALTER TABLE `__new_account_transfers` RENAME TO `account_transfers`;--> statement-breakpoint
CREATE INDEX `account_transfers_owner_event_idx` ON `account_transfers` (`owner_id`,`event_date`);--> statement-breakpoint
CREATE INDEX `account_transfers_source_idx` ON `account_transfers` (`source_account_id`);--> statement-breakpoint
CREATE INDEX `account_transfers_destination_idx` ON `account_transfers` (`destination_account_id`);--> statement-breakpoint
CREATE INDEX `account_transfers_event_date_idx` ON `account_transfers` (`event_date`);--> statement-breakpoint
PRAGMA foreign_keys = ON;