-- Adds business contact details and protected client bank information.
-- The last four bank-account digits are stored separately for display without revealing the full
-- number.
-- Run these numbered database updates in order. Add a new file for future table changes.
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
