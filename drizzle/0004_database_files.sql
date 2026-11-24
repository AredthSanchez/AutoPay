-- Adds D1 attachment metadata and ordered binary chunks for the optional database-backed file adapter.
-- Apply migrations in numeric order; add a new migration for future schema changes.
CREATE TABLE file_objects (
  key text PRIMARY KEY NOT NULL,
  size integer NOT NULL,
  chunks integer NOT NULL
);

--> statement-breakpoint
CREATE TABLE file_chunks (
  key text NOT NULL REFERENCES file_objects (key),
  sequence integer NOT NULL,
  data blob NOT NULL,
  PRIMARY KEY (key, sequence)
);
