CREATE TABLE legacy_identity_links (
  email text PRIMARY KEY NOT NULL,
  old_user_id text NOT NULL UNIQUE,
  claimed_by text
);
