ALTER TABLE `credit_card_bill_payments` ADD `idempotency_key` text NOT NULL DEFAULT '';--> statement-breakpoint
UPDATE `credit_card_bill_payments`
SET `idempotency_key` = 'legacy-' || `id`
WHERE `idempotency_key` = '';--> statement-breakpoint
CREATE UNIQUE INDEX `credit_card_bill_payments_idempotency_unique` ON `credit_card_bill_payments` (`idempotency_key`);
