-- Adds tables that describe each uploaded file and store its contents in numbered pieces.
-- Run these numbered database updates in order. Add a new file for future table changes.
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
