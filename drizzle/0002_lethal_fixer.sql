-- Adds request counters used for optional paid assistant usage limits.
-- Apply migrations in numeric order; add a new migration for future schema changes.
CREATE TABLE `ai_usage` (
  `business` text NOT NULL,
  `hour` text NOT NULL,
  `requests` integer NOT NULL
);

--> statement-breakpoint
CREATE UNIQUE INDEX `ai_usage_business_hour` ON `ai_usage` (`business`, `hour`);
