CREATE INDEX `transactions_budget_month_event_idx` ON `transactions` (`budget_month`,`event_date`,`description`);--> statement-breakpoint
CREATE INDEX `transactions_budget_month_status_idx` ON `transactions` (`budget_month`,`status`);--> statement-breakpoint
CREATE INDEX `transactions_event_date_status_idx` ON `transactions` (`event_date`,`status`);--> statement-breakpoint
CREATE INDEX `transactions_credit_card_month_idx` ON `transactions` (`credit_card_id`,`budget_month`);