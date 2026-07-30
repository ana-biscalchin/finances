PRAGMA defer_foreign_keys = ON;--> statement-breakpoint
PRAGMA foreign_keys = OFF;--> statement-breakpoint
DROP INDEX `categories_nature_name_unique`;--> statement-breakpoint
DROP INDEX `categories_nature_idx`;--> statement-breakpoint
CREATE TABLE `__new_categories` (
  `id` text PRIMARY KEY NOT NULL,
  `owner_id` text NOT NULL,
  `nature` text NOT NULL,
  `name` text NOT NULL,
  `sort_order` integer DEFAULT 0 NOT NULL,
  `is_active` integer DEFAULT true NOT NULL,
  `archived_at` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
INSERT INTO `__new_categories` (`id`, `owner_id`, `nature`, `name`, `sort_order`, `is_active`, `archived_at`, `created_at`, `updated_at`)
SELECT `id`, (SELECT `id` FROM `users` WHERE `username` = migration_owner_username()), `nature`, `name`, `sort_order`, `is_active`, `archived_at`, `created_at`, `updated_at`
FROM `categories`;--> statement-breakpoint
DROP TABLE `categories`;--> statement-breakpoint
ALTER TABLE `__new_categories` RENAME TO `categories`;--> statement-breakpoint
CREATE UNIQUE INDEX `categories_owner_nature_name_unique` ON `categories` (`owner_id`,`nature`,`name`);--> statement-breakpoint
CREATE INDEX `categories_owner_nature_idx` ON `categories` (`owner_id`,`nature`);--> statement-breakpoint
PRAGMA foreign_keys = ON;
