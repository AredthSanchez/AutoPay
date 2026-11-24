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
