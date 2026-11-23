# AutoPay

Live app: https://autopay.aredthsanchez.workers.dev/

A shared business invoice workspace with individual email/password accounts. The app runs directly in your Cloudflare account; Supabase handles identity.

For a complete explanation of the architecture, every source module, database tables, API routes, deployment, tests, and limitations, read the [Complete Project Guide](docs/PROJECT_GUIDE.md).

## Features

- Supabase email/password signup and login, email verification, password recovery and logout.
- Business owner/member roles, verified-email team invitations and shared business workspaces.
- Scheduled daily/weekly email reports with timezone settings, delivery history, and retries.
- Blue theme, clearable dropdowns, and per-row invoice notes/attachments.
- Editable invoices, statuses, dates, payment methods/check references, notes, filters, Excel export, attention flags, bulk selection/actions, sorting, quick views, pagination, duplicate drafts, manual payment recording, and restorable Trash.
- Client profiles, business addresses and owner-only encrypted bank instructions.
- Invoice attachments stored in chunked D1 records for this testing version: 5 MB per file, 10 files and 25 MB per invoice. R2 is optional for future scale; no R2 subscription is required now.
- Free rule-based invoice/client assistant. `AUTOPAY_CHAT_MODE=testing` makes no OpenAI calls.
- Optional Resend invoice notifications. Real collection calls and money transfers are not enabled.

## Development

Requires Node 22.13+ and npm. This checkout uses React, Vite, Cloudflare Workers and D1.

```sh
npm ci
npm run db:migrate:local
npm run dev
```

The checked-in Supabase URL and publishable key identify this app's project and are public by design. For another project, change those values in `wrangler.jsonc`. A service-role/secret Supabase key must never be used in public configuration. Optional local secrets belong in ignored `.dev.vars`; see `.dev.vars.example`. Local development uses real Supabase identity, with the callback URLs listed below added to the project's allowlist. There is no mock identity-header bypass.

```sh
npm test
npm run build
npm run worker:check
```

## Cloudflare deployment

```sh
npx wrangler login
# For a NEW account/database only:
npx wrangler d1 create autopay
```

Set the returned database ID and your account ID in `wrangler.jsonc`. Preserve the existing configured IDs when deploying this project again.

```sh
npm run db:migrate:remote
npx wrangler secret put BANK_DATA_KEY
# Optional new-invoice email alerts:
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put MAIL_FROM_EMAIL
npm run deploy
```

`BANK_DATA_KEY` is a base64-encoded 32-byte key. Back it up securely; do not rotate it while encrypted records depend on it without re-encrypting them. All secrets, uploads, exports, local state and dependencies are ignored by Git. No Supabase service-role key is required.

## Supabase setup

Project: AutoPay (`mlekcbzvlczukfnocfpg`). Keep email/password authentication enabled and email confirmations on. Set the Site URL to the deployed Cloudflare origin. Add these exact redirect URLs for the production origin:

- `/auth/callback`
- `/reset-password`

For local development, add `http://127.0.0.1:5173/auth/callback` and `http://127.0.0.1:5173/reset-password`, or the actual port used by Vite.

The browser uses PKCE through the official Supabase SDK. The Worker verifies each bearer token by calling Supabase Auth's user endpoint. It requires a confirmed email and checks business membership before returning records. It ignores identity headers from the previous host. The database and files are accessible only through this authorized server API.

Supabase's built-in mail sender is for development and can send confirmation/reset emails only to project team addresses. Configure a production SMTP sender with a verified sending domain before opening signup to other users. Keep email confirmation enabled; imported ownership relies on verified emails. Do not use a test mail sender to claim production email delivery.

## Moving existing records

See [docs/MIGRATION.md](docs/MIGRATION.md). The previous source ZIP is retained as an archive; the editable application is now the ordinary source tree at the repository root.

Official references: [Supabase password auth](https://supabase.com/docs/guides/auth/passwords), [Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [Cloudflare Workers assets](https://developers.cloudflare.com/workers/static-assets/).
