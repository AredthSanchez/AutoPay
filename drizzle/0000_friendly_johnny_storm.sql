-- Creates the first tables for accounts, businesses, invoices, clients, files, and email
-- notices.
-- On business records, the older column name owner means the business ID, not a person's account
-- ID.
-- Run these numbered database updates in order. Add a new file for future table changes.
CREATE TABLE `accounts` (
  `id` text PRIMARY KEY NOT NULL,
  `email` text NOT NULL,
  `name` text NOT NULL,
  `created_at` text NOT NULL
);

--> statement-breakpoint
CREATE TABLE `attachments` (
  `id` text PRIMARY KEY NOT NULL,
  `owner` text NOT NULL,
  `invoice` text NOT NULL,
  `name` text NOT NULL,
  `size` integer NOT NULL,
  `key` text NOT NULL,
  `created_at` text NOT NULL
);

--> statement-breakpoint
CREATE INDEX `files_business_invoice` ON `attachments` (`owner`, `invoice`);

--> statement-breakpoint
CREATE TABLE `businesses` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `owner_id` text NOT NULL,
  `created_at` text NOT NULL,
  `notification_email` text,
  `notifications_enabled` integer DEFAULT 0 NOT NULL
);

--> statement-breakpoint
CREATE TABLE `clients` (
  `id` text PRIMARY KEY NOT NULL,
  `owner` text NOT NULL,
  `email` text NOT NULL,
  `data` text NOT NULL
);

--> statement-breakpoint
CREATE UNIQUE INDEX `clients_business_email` ON `clients` (`owner`, `email`);

--> statement-breakpoint
CREATE TABLE `invites` (
  `id` text PRIMARY KEY NOT NULL,
  `business` text NOT NULL,
  `email` text NOT NULL,
  `token_hash` text NOT NULL,
  `created_at` text NOT NULL,
  `expires_at` text NOT NULL,
  `used_at` text
);

--> statement-breakpoint
CREATE UNIQUE INDEX `invite_hash` ON `invites` (`token_hash`);

--> statement-breakpoint
CREATE TABLE `invoices` (
  `id` text PRIMARY KEY NOT NULL,
  `owner` text NOT NULL,
  `number` text NOT NULL,
  `data` text NOT NULL,
  `deleted` integer DEFAULT 0 NOT NULL,
  `version` integer DEFAULT 0 NOT NULL,
  `created_at` text NOT NULL
);

--> statement-breakpoint
CREATE UNIQUE INDEX `invoices_business_number` ON `invoices` (`owner`, `number`);

--> statement-breakpoint
CREATE INDEX `invoices_business` ON `invoices` (`owner`);

--> statement-breakpoint
CREATE TABLE `memberships` (
  `id` text PRIMARY KEY NOT NULL,
  `business` text NOT NULL,
  `user_id` text NOT NULL,
  `role` text NOT NULL
);

--> statement-breakpoint
CREATE UNIQUE INDEX `business_user` ON `memberships` (`business`, `user_id`);

--> statement-breakpoint
CREATE INDEX `members_user` ON `memberships` (`user_id`);

--> statement-breakpoint
CREATE TABLE `notifications` (
  `id` text PRIMARY KEY NOT NULL,
  `owner` text NOT NULL,
  `invoice` text NOT NULL,
  `recipient` text NOT NULL,
  `status` text NOT NULL,
  `payload` text NOT NULL,
  `created_at` text NOT NULL,
  `attempts` integer DEFAULT 0 NOT NULL,
  `last_attempt` text,
  `error` text,
  `provider_id` text
);

--> statement-breakpoint
CREATE INDEX `notifications_business` ON `notifications` (`owner`);
