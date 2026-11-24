-- Adds a flag for imported clients whose bank information must be entered again by the owner.
-- Run these numbered database updates in order. Add a new file for future table changes.
ALTER TABLE clients
ADD COLUMN bank_needs_reentry integer NOT NULL DEFAULT 0;
