# Existing workspace migration

The previous app used managed identity IDs and host-owned D1 storage. The new app uses a separate D1 database in the owner's Cloudflare account and Supabase identities. Replacing an old identity header with a user-provided email is not safe and is not supported.

The migration imports records with their existing business and invoice IDs. It adds an explicit `legacy_identity_links` mapping from each imported account's normalized email to its former user ID. After that person creates and verifies a Supabase account using the same email, the Worker atomically moves that old ID's profile, memberships and owned businesses to the verified new ID. Caller-supplied display names or identity headers cannot select ownership. Duplicate mapping emails or conflicting existing accounts require manual review.

The migration snapshot contains 2 accounts, 3 businesses, 4 clients, 5 invoices, 3 memberships and 5 notification records. There were no stored attachments or pending invitations in that snapshot. Original records remain on the old site as a backup; updates after the snapshot need a separate import before final cutover. Private exports and import SQL must never be committed to Git.

One client bank record uses an encryption key retained by the previous host. Its ciphertext and masked last four digits are preserved and marked `bank_needs_reentry=1`. The business owner is explicitly asked to re-enter the bank details. Saving new details encrypts them with the new host's `BANK_DATA_KEY` and clears that flag. This avoids presenting undecipherable data as a successful bank migration. The previous record remains recoverable on the old app while it remains available.

For future file growth, add an R2 binding named `BUCKET`; the Worker automatically uses it for new file operations. Move existing D1 file objects into that bucket with their exact stored keys before enabling the binding, or old attachments will be unavailable. Back up D1 and the encryption key before any storage migration.

Before switching users to the new URL, configure Supabase's production Site URL, callback/reset allowlist and production SMTP. Use the same verified email as the previous account to recover the imported businesses. Test owner/member separation, upload/download, and password recovery. Do not delete the previous host or its data until these checks are complete.
