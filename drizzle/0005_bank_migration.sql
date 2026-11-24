-- Marks imported client bank records that require the owner to enter their details again.
-- Apply migrations in numeric order; add a new migration for future schema changes.
ALTER TABLE clients
ADD COLUMN bank_needs_reentry integer NOT NULL DEFAULT 0;
