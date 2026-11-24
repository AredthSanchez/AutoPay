-- Adds business profile fields and encrypted bank ciphertext plus a display-only last-four suffix.
-- Apply migrations in numeric order; add a new migration for future schema changes.
ALTER TABLE `businesses`
ADD `owner_name` text DEFAULT '' NOT NULL;

--> statement-breakpoint
ALTER TABLE `businesses`
ADD `address` text DEFAULT '' NOT NULL;

--> statement-breakpoint
ALTER TABLE `businesses`
ADD `phone` text DEFAULT '' NOT NULL;

--> statement-breakpoint
ALTER TABLE `businesses`
ADD `website` text DEFAULT '' NOT NULL;

--> statement-breakpoint
ALTER TABLE `clients`
ADD `bank_cipher` text;

--> statement-breakpoint
ALTER TABLE `clients`
ADD `bank_last4` text;
