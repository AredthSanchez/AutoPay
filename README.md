# AutoPay source snapshot

The complete project is in `AutoPay-source.zip`, including its original directory structure. Credentials, local databases, uploads, and generated dependencies are excluded.

```sh
unzip AutoPay-source.zip
cd autopay
npm ci
```

Live application: https://aredth-autopay.primeswift1.chatgpt.site/

This archive includes free AutoPay Assistant testing mode. It calculates common invoice/client reports without an OpenAI key or OpenAI API charges. Paid provider mode is disabled by default. The source is archived here; extract the ZIP to work with the normal source tree.

# AutoPay — Business invoice workspace

Individual logins. Shared business invoices, clients, payments, and files.

## Current hosted application

The published app uses React/Vinext on Cloudflare Workers, D1 for business records, R2 for invoice files, and platform-managed ChatGPT sign-in. Public visitors can create a business or join an email-bound team invitation. Each request verifies business membership server-side. The owner manages business information, invitations, bank details, and invoice-alert settings.

Features:
- Sign-up, login, logout, multiple business workspaces, owner/member roles.
- Shared client directory with clickable profiles, editable contact information, business addresses and notes.
- Owner-only bank editor with masked account numbers. Full bank data is encrypted with AES-GCM and bound to the business/client context.
- Invoice creation and editing, payment method/check references, payment dates, aging, filters, search, printable invoices, CSV exports, and restorable Trash.
- Invoice attachments in R2, accessible only to the owning business.
- Per-business new-invoice email alerts through Resend, a durable outbox, delivery-status reporting, and retries.

## Run locally

Requires Node 22.13+ and npm. The hosting integration uses the Sites execution profile and native D1/R2 bindings.

```sh
npm ci
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_friendly_johnny_storm.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_lethal_madame_masque.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0002_lethal_fixer.sql
npm run dev -- --port 5180
```

Apply each migration once. Portable local development uses the starter's loopback-only mock sign-in. Production authentication is owned by Sites dispatch; never trust identity headers from an untrusted reverse proxy on another hosting platform.

## Runtime secrets

Configure hosted values as secrets; never commit credentials or put them in the frontend:
- BANK_DATA_KEY: base64-encoded 32-byte AES-GCM key. Back it up securely. Rotating it requires re-encrypting stored bank data.
- RESEND_API_KEY: sending-only Resend API key.
- MAIL_FROM_EMAIL: a verified sender, or AutoPay <onboarding@resend.dev> for initial testing.
- RESEND_TEST_RECIPIENT: restricts notifications to one Resend account inbox when using the test sender. Remove this restriction only after verifying a sending domain.
- INITIAL_OWNER_EMAIL and INITIAL_NOTIFICATION_EMAIL: optional default alert recipient applied only when the authenticated owner's email matches INITIAL_OWNER_EMAIL.

Full bank details never appear in client-list responses, search, exports, or notification emails. Server storage is encrypted, but an authorized owner can reveal them in the browser. Bank details do not initiate transfers. No card data is collected by the app.

## Team and email workflow

1. Sign up with ChatGPT and create your business.
2. Open Settings to edit your display name, business owner name, contact details, and business address.
3. Create an invitation for a teammate's email and share its expiring link. They sign in individually with that exact email and join the shared business.
4. Set the new-invoice notification recipient in Settings. Every team member's newly created invoice creates a durable alert and attempts delivery.
5. The notification log reports Sent, Failed, or Pending setup. Sent means the provider accepted the request, not that it reached the inbox. Resend's test sender is restricted to the Resend account email until a domain is verified.

## Tests

```sh
node --test tests/business-isolation.test.mjs frontend/src/domain.test.js
```

Tests cover shared membership, cross-business access rejection, origin/CSRF checks, scoped attachments, encrypted bank records, durable email alerts, idempotent delivery retries, financial totals, aging, filters, and search. Provider calls in automated tests are mocked.

## Earlier Java portfolio implementation

`backend/`, `frontend/`, `Dockerfile`, and `compose.yaml` retain the earlier Java Spring Boot / MySQL reference implementation. It is a single-workspace local portfolio app, not the hosted multi-business auth backend. Its Twilio hooks are not connected to the hosted cloud application. Do not expose it as a multi-business production service without adding equivalent membership authorization. The previous executable JAR is a legacy build.

The hosted app supports payment simulations and manual bookkeeping, but it does not place real payment calls or charge money. Live payments require a separately configured provider/backend integration. No account passwords are stored by AutoPay.

### AutoPay Assistant — free testing mode

Open **Assistant** in the workspace sidebar. The default mode calculates summaries inside AutoPay without calling OpenAI. No API key is needed and chat requests create no OpenAI API charges. This is a rule-based testing assistant, not a generative AI model. Try invoice summaries, overdue/paid/unpaid reports, client balance rankings, a full client name, or an invoice number. Basic follow-ups retain a previously named client. Unsupported questions explain the available reports; arbitrary date ranges and general AI conversation are not supported.

Membership is checked on every request. Bank fields, notes, check references, contact emails/phones, and files are excluded from chat context. Summaries read current, non-deleted business records, up to 1,000 invoices and clients; lists show 10 rows and explain omissions. Conversation history stays in component memory and clears when leaving the Assistant page or switching businesses. No payments, calls, edits, or emails can be initiated by the assistant. Normal app hosting/storage usage is separate from OpenAI API billing.

`AUTOPAY_CHAT_MODE` defaults to `testing`. Only the exact server value `openai` can enable paid provider calls; supplying a key alone does not activate them, and clients cannot override the mode. The live testing deployment sets `AUTOPAY_CHAT_MODE=testing`. Keep this value for testing.

Optional paid integration retained for later: explicitly set `AUTOPAY_CHAT_MODE=openai` and configure `OPENAI_API_KEY` as a server secret using the OpenAI Developers secure flow, then redeploy. This incurs OpenAI usage charges. It uses the Responses API with `store: false`, default model `gpt-5-mini` (`OPENAI_MODEL` can override). Keys must never be put in browser code, chat messages, source, or public environment variables. Paid mode limits usage to 30 questions per business per hour and 200 site-wide per UTC day, with details capped at 200 invoices/clients. Automated provider tests use mocks. Testing mode has no paid-provider usage counters.
