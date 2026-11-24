-- Adds a table linking confirmed email addresses to accounts imported from the old app.
-- Only prepared links may be claimed; entering someone else's email is not enough to log in as
-- them.
-- Run these numbered database updates in order. Add a new file for future table changes.
CREATE TABLE legacy_identity_links (
  email text PRIMARY KEY NOT NULL,
  old_user_id text NOT NULL UNIQUE,
  claimed_by text
);
