CREATE TABLE `installment_purchases` (
  `id` text PRIMARY KEY NOT NULL,
  `credit_card_id` text NOT NULL,
  `original_description` text NOT NULL,
  `normalized_description` text NOT NULL,
  `original_event_date` text NOT NULL,
  `installment_count` integer NOT NULL,
  `total_amount_cents` integer,
  `source` text NOT NULL DEFAULT 'manual',
  `status` text NOT NULL DEFAULT 'active',
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`credit_card_id`) REFERENCES `credit_cards`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `installment_purchases_card_idx` ON `installment_purchases` (`credit_card_id`);
--> statement-breakpoint
CREATE INDEX `installment_purchases_lookup_idx` ON `installment_purchases` (`credit_card_id`,`normalized_description`,`installment_count`);
--> statement-breakpoint
ALTER TABLE `installments` ADD `installment_purchase_id` text REFERENCES `installment_purchases`(`id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `installments_purchase_group_number_unique` ON `installments` (`installment_purchase_id`,`installment_number`);
