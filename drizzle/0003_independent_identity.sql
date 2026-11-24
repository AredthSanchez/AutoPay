-- Explicit verified-email mapping for claiming imported identities; not a general email-based login bypass.
-- Apply migrations in numeric order; add a new migration for future schema changes.
CREATE TABLE legacy_identity_links (
  email text PRIMARY KEY NOT NULL,
  old_user_id text NOT NULL UNIQUE,
  claimed_by text
);
