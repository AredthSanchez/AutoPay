ALTER TABLE clients
ADD COLUMN bank_needs_reentry integer NOT NULL DEFAULT 0;
