PRAGMA defer_foreign_keys = ON;--> statement-breakpoint
PRAGMA foreign_keys = OFF;--> statement-breakpoint
CREATE TABLE `__new_settings` (`owner_id` text NOT NULL,`key` text NOT NULL,`value` text,`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,PRIMARY KEY(`owner_id`,`key`),FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`));--> statement-breakpoint
INSERT INTO `__new_settings` (`owner_id`,`key`,`value`,`created_at`,`updated_at`) SELECT (SELECT `id` FROM `users` WHERE `username` = migration_owner_username()),`key`,`value`,`created_at`,`updated_at` FROM `settings`;--> statement-breakpoint
DROP TABLE `settings`;--> statement-breakpoint
ALTER TABLE `__new_settings` RENAME TO `settings`;--> statement-breakpoint
CREATE TABLE `__new_reserve_goals` (`id` text PRIMARY KEY NOT NULL,`owner_id` text NOT NULL,`name` text NOT NULL,`target_amount_cents` integer,`account_id` text,`target_date` text,`status` text DEFAULT 'active' NOT NULL,`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`),FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`));--> statement-breakpoint
INSERT INTO `__new_reserve_goals` (`id`,`owner_id`,`name`,`target_amount_cents`,`account_id`,`target_date`,`status`,`created_at`,`updated_at`) SELECT `id`,(SELECT `id` FROM `users` WHERE `username` = migration_owner_username()),`name`,`target_amount_cents`,`account_id`,`target_date`,`status`,`created_at`,`updated_at` FROM `reserve_goals`;--> statement-breakpoint
DROP TABLE `reserve_goals`;--> statement-breakpoint
ALTER TABLE `__new_reserve_goals` RENAME TO `reserve_goals`;--> statement-breakpoint
CREATE INDEX `reserve_goals_owner_status_idx` ON `reserve_goals` (`owner_id`,`status`);--> statement-breakpoint
PRAGMA foreign_keys = ON;