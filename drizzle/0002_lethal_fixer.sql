-- Adds counters for limiting the number of questions sent to the optional paid assistant.
-- Run these numbered database updates in order. Add a new file for future table changes.
CREATE TABLE `ai_usage` (
  `business` text NOT NULL,
  `hour` text NOT NULL,
  `requests` integer NOT NULL
);

--> statement-breakpoint
CREATE UNIQUE INDEX `ai_usage_business_hour` ON `ai_usage` (`business`, `hour`);
