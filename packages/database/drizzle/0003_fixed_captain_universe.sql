CREATE INDEX `transactions_account_idx` ON `transactions` (`account_id`);--> statement-breakpoint
CREATE INDEX `transactions_credit_card_idx` ON `transactions` (`credit_card_id`);--> statement-breakpoint
CREATE INDEX `transactions_credit_card_bill_idx` ON `transactions` (`credit_card_bill_id`);