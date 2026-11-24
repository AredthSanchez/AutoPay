# AutoPay: presentation and technical questions

Use alongside the [code walkthrough](STUDY_GUIDE.md), [tool inventory](TOOLS_AND_SERVICES.md), and [file guide](FILE_GUIDE.md). Answers below describe the root application, not the archived Java project. They are prompts for rehearsal, not claims that every feature has been independently verified in production.

## Explaining the diagram out loud

> The top box is the screen I use. When I save an invoice, it sends the form to the middle box, which is the server code. That code checks my login, my business access, and the invoice fields. It then saves the invoice in the bottom box, the database. The result travels back to the screen. React builds the screen, Cloudflare Workers runs the checks, and Cloudflare D1 stores the records.

If asked where passwords are handled, explain that Supabase is the separate login service. If asked where email is handled, show the separate email diagram. These services support the main flow; they are not additional screens the user must operate.

## Project introduction

> AutoPay is a shared invoice workspace for businesses. Each team member has an individual login, while access to invoices and clients is controlled by business membership. The app supports editing and filtering invoices, attachments, Excel export, payment records, email reports, and invoice summaries. Its current payment features record activity; they do not move money or place real collection calls.

## Development process and contribution

A clear description of how this project was built:

> I defined the product idea and directed the requirements through successive versions, including shared business access, editable invoices, client banking, reports, and chat. I used ChatGPT and Codex to help generate, revise, document, and test the implementation. I am studying the code and tests so I can explain the design and make informed changes.

Adjust the final sentence as your understanding develops. Separate what you specified, what tools generated, what you can now explain, and what you personally tested. Do not claim to have independently written every module or designed a custom AI model. AI-assisted implementation does not prevent a technical discussion; being precise about the code and its limits is what makes that discussion useful.

## Eight-minute presentation outline

| Time      | Topic                 | What to show or explain                                                                                                                               |
| --------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0:00–0:45 | Problem               | Businesses need one place for invoice follow-up, records, and team access. State the current scope.                                                   |
| 0:45–1:30 | Main workflow         | Open a test business, find a client, create an invoice, and show its details.                                                                         |
| 1:30–2:30 | Architecture          | React browser → Worker API → permission checks → D1. Supabase handles identity.                                                                       |
| 2:30–3:30 | One request           | Trace invoice creation from `api.create()` through validation and the database insert.                                                                |
| 3:30–4:30 | Shared access         | Explain accounts versus businesses, membership checks, owner-only banking/settings.                                                                   |
| 4:30–5:30 | Technical details     | Integer-cent arithmetic, invoice version checks, attachment chunks, or email retries. Choose two you can explain deeply.                              |
| 5:30–6:30 | Reports and chat      | Show settings/history and a free testing-mode question. Explain what is optional or simulated.                                                        |
| 6:30–7:15 | Verification          | Show test names and one meaningful assertion, then build/test results.                                                                                |
| 7:15–8:00 | Limits and next steps | Live calling is unavailable; discuss browser tests, data normalization, and stronger stale-form detection. State the AI-assisted development process. |

## Demo preparation

Use a separate test business with fictional contact information. Prepare one unpaid invoice, one overdue invoice, one paid invoice with a payment method, and one flagged invoice. Avoid exposing bank information, API keys, or another user's records.

A useful sequence is: search for a client → create an invoice → edit notes → attach a harmless text file → flag/check the invoice → export Excel → move it to Trash and restore → ask for overdue invoices in testing chat. Use existing delivery history for the report explanation unless a test email is intentionally authorized and configured. Do not trigger remote migrations or live deployment during the presentation.

If login or networking fails, use the architecture diagram, code, and tests. Explain that production-provider behavior and mocked tests are different evidence.

## Technical questions and follow-ups

### What happens when someone clicks Create invoice?

The form sends JSON through `api.create()`. The Worker verifies the login, and the service checks membership and fields. It computes the total, saves a business-scoped invoice and related records, and returns the result. The screen reloads its data.

**Follow-up: Could someone bypass the form validation?** Yes, browser checks can be bypassed. The server repeats validation and recalculates the total. Point to `draft()` and `total()`.

### How does React know to update the screen?

A state setter changes a remembered value, such as the invoices array or selected dialog. React calls the component again to calculate the displayed result. Saving to the database still requires a separate request.

**Follow-up: Props versus state?** Props are inputs from a parent component; state is maintained by the component. A form receives an `onSave` prop and keeps its current field values in state.

### What does useEffect do here?

It connects the screen to outside work such as loading data, subscriptions, timers, or keyboard listeners. Cleanup removes those connections when appropriate. Rendering should describe the screen rather than repeatedly start requests by itself.

**Follow-up: Why guard old profile requests?** They may finish out of order. A sequence number and mounted check prevent an old result from replacing a newer login state.

### What is the backend framework?

The current backend is a Cloudflare Worker using standard Request/Response objects and a custom `AutoPayService` router. It is not Express or Spring Boot. Vite and the Cloudflare plugin build and run it.

### Why both Supabase and Cloudflare?

Supabase manages accounts, passwords, and sessions. Cloudflare hosts the browser assets and server code; D1 stores business data. The server joins a verified identity to business memberships.

**Follow-up: Is invoice access controlled by Supabase RLS?** No. The invoice database is D1, and business access is enforced in the Worker/service queries. Do not attribute the app's business isolation to Postgres row-level security.

### How are authentication and authorization different?

Authentication answers who the user is. Authorization decides whether that user may access the selected business or perform an owner-only action. A valid token does not grant access to every business.

**Follow-up: What if someone changes X-AutoPay-Business?** `scope()` checks that user's membership for the new value. Scoped record queries also include the business ID.

### How do separate logins see the same invoices?

`memberships` connects multiple account IDs to one business ID. Queries use that shared business ID after membership is verified.

**Follow-up: Are changes pushed in real time?** No push subscription is implemented. The screens refresh after their own actions, and an existing periodic reload is conditional on `live` capability. Shared database access is different from instant screen synchronization.

### Why are public Supabase keys checked into the repository?

They identify the project and are intended for browser use. They do not replace user login or business checks. Private administrator/service-role keys must not be exposed; this implementation rejects them in public configuration.

### How do invitations work?

The service creates an invitation for an email address and saves a hash of its random token, expiry, and use state. Joining requires the token and a verified matching email. The database records membership and marks the invitation used.

**Follow-up: Why hash the token?** The server only needs to compare a submitted token with the saved hash; it does not need to recover the original token from storage.

### Why use prepared SQL?

The SQL instructions stay separate from values passed with `bind()`. Input is treated as data rather than new SQL instructions. This reduces SQL injection risk; it does not replace permission and field checks.

### Is Drizzle ORM used?

Not in the current root runtime. The app uses prepared SQL through D1. Numbered migrations remain in a directory named `drizzle` from earlier development.

### Why store invoice data as JSON?

Invoices have nested items and activity. JSON keeps those together while separate columns support scope, IDs, uniqueness, deletion, and versions. The tradeoff is weaker database structure for nested fields and more work for complex reporting. Separate line-item/payment tables are a reasonable next step.

### How do you avoid currency rounding errors?

The shared helper parses unit prices into integer cents before multiplying and summing. The server validates quantities and recalculates totals instead of trusting the browser.

**Follow-up: Why not simply use 0.1 + 0.2?** Binary floating-point cannot represent many decimal fractions exactly. Integer cents avoid that issue for supported two-decimal USD values, within validated bounds.

### How is overdue status determined?

An invoice stored as OPEN is displayed as overdue if its due date is before the comparison date. PAID aging stops on its payment date, and VOID has no overdue-day count. Overdue is derived rather than a separately maintained stored status.

### What if two users edit one invoice?

`writeInvoice()` updates only the version it read and increments it. Competing server operations that read the same version cannot both overwrite it successfully.

**Follow-up: Does it catch every stale form?** No. The browser does not submit the version from when a form opened. Adding an expected version to the form/request would extend conflict detection across the entire edit session.

### Does delete permanently erase an invoice?

No. It marks the record deleted and excludes it from normal listings. Restore reverses that flag through a business-authorized request. Permanent erasure, retention policy, and attachment cleanup would need a separate design.

### How is bank information protected?

Owner-only endpoints validate fields and use AES-GCM field encryption with a 32-byte server key, a fresh random IV, and business/client IDs as authenticated context. The ordinary client list does not provide full bank details.

**Follow-up: Is it end-to-end encrypted?** No. The server holds the key and can decrypt authorized requests. Losing or replacing that key without migration makes existing ciphertext unreadable. This is not bank-account verification or payment compliance certification.

### Encryption versus hashing?

Encryption is reversible with a key, so bank details can be read later. Hashing supports comparison without recovering the original value, which suits invitation tokens. The app does not implement its own password database; Supabase manages passwords.

### How are attachments stored?

Metadata links each file to a business and invoice. By default, the contents live in D1 as ordered 128 KiB chunks. The server checks access and file/count/total-size limits. R2 can replace the byte-storage adapter but is not configured in the current root settings.

**Follow-up: What are the limits?** 5 MiB per file, 10 files and 25 MiB per invoice. There is no built-in malware scanner in this code.

### How does the Excel export work?

The browser creates spreadsheet XML and wraps it in ZIP structures to produce an XLSX file. Text uses string cells, and amounts use numeric cells. It exports checked invoices or the current filtered list without changing saved records.

**Follow-up: Which Excel library?** No external Excel library. `excel.js` implements the small subset required here, including CRC checksums and ZIP directory records.

### What prevents duplicate scheduled emails?

A saved business/day report ID, conditional database updates, a temporary send reservation, and stable provider idempotency keys reduce duplicates. A delivery queue stores failures for retry.

**Follow-up: Is that exactly once?** Do not promise absolute exactly-once delivery. A network timeout can leave acceptance uncertain, and external provider guarantees have limits. `SENT` means provider acceptance, not inbox delivery or reading.

### How are timezones handled?

The scheduler compares future UTC quarter-hours to the business's selected timezone. It excludes an already scheduled local date to reduce duplicate sends when daylight saving time repeats an hour. Fixed-date tests cover timezone boundaries and clock changes.

### Is the chatbot AI?

The default testing mode is rule-based JavaScript and makes no OpenAI calls. Optional paid mode sends a sanitized business snapshot to OpenAI's Responses API. There is no training or fine-tuning in this project.

**Follow-up: Can it edit invoices or expose bank details?** It has no tools for changes and receives no bank information. Server-side omission is stronger than just asking the model not to reveal something. Other record fields and prompts remain untrusted, and generated answers still need verification.

### Why truncate assistant details if totals cover everything?

The server calculates totals before limiting individual records sent to the provider. This bounds request size, but a detailed question may require records omitted from the snapshot. Coverage limits must be disclosed rather than invented around.

### Can AutoPay charge a client or make a collection call?

The current Worker cannot. Manual payment recording changes bookkeeping, and voice simulation is labeled as demo activity. The Java/Twilio implementation exists in the archive; it is not the currently deployed Worker backend.

### What do the tests prove?

The 39 tests at this documentation baseline check calculations and important server behavior using temporary SQLite and mocked services. They cover business isolation, identity, encryption, files, exports, chat, and reports.

**Follow-up: What is missing?** Real provider configuration/delivery, browser end-to-end tests, broader load testing, independent security review, and full production-operational validation. A build or green unit suite does not prove all of those.

### What happens when a service fails?

Invalid logins fail closed; database/provider errors produce appropriate failure responses rather than fabricated success. Email attempts remain recorded for bounded retry. Missing OpenAI setup is reported, while testing mode avoids that provider entirely. Consult the exact route instead of assuming one fallback covers every failure.

### What would you improve next?

Prioritize browser end-to-end tests, full form-to-save version checking, larger-workspace pagination/reporting, attachment storage migration to R2 when justified, normalized payment/item tables, and better operational monitoring. Real calling/payments would be a separate integration with stronger consent, provider, security, and failure-handling requirements.

### Why does wrangler.jsonc need strict JSON here?

Wrangler can read JSONC, but the project's setup checker uses JavaScript's `JSON.parse`, which accepts only ordinary JSON. The checked-in file therefore avoids comments and trailing commas. A mismatch between the configuration format and a custom tool's parser can break a deployment check even when the app build succeeds.

### How efficient are filtering and sorting?

Filtering visits the loaded invoices, so a simple pass grows roughly in proportion to the number of invoices. Sorting makes a copy and typically takes O(n log n) comparisons; the exact JavaScript engine algorithm is not chosen by this app. Text search also depends on the number of query terms and text length. This implementation loads business lists into the browser, so server pagination and indexed queries would be preferable for much larger datasets.

**Follow-up: Are all assistant calculations linear?** No. Building client totals currently filters the invoice list per client, so that part can grow roughly with clients × invoices. A single-pass map keyed by client identity would be a possible improvement. The service's record limits also bound the current supported workload.

### Why use await, and can it cause race conditions?

`await` pauses the current async function until an operation completes; it does not stop other requests from running. Two requests can still read the same record or try to send the same email. Version conditions and atomic database updates address those particular races. Async syntax alone is not a lock or a transaction.

### Is X-AutoPay-Request a secret CSRF token?

No. Its value is the constant `1`, so it should be described as a custom request marker, not a random secret. The service also checks Origin and Sec-Fetch-Site on writes and requires bearer authentication and membership. Explain those layers together rather than claiming the marker alone proves a request is legitimate.

### What would happen if invoice and email creation partly failed?

Read the invoice-creation branch and its `db.batch()` statements: related database inserts are grouped, while contacting an external provider is a separate operation. A database transaction cannot atomically include a remote email server. Saved notification records let the app report or retry delivery rather than treating an invoice save as proof of email receipt.

## Code-defense rehearsal

For each answer, locate the function and a supporting test. Then explain an input, an output, a failure case, and one limitation. Good starting points:

| Topic       | Code                                     | Evidence to find                                                  |
| ----------- | ---------------------------------------- | ----------------------------------------------------------------- |
| Membership  | `AutoPayService.scope()`                 | Cross-business request rejection in business-isolation tests.     |
| Money       | `cents()` / `total()`                    | Valid decimal totals and rejected invalid prices.                 |
| Conflicts   | `writeInvoice()`                         | SQL version condition; distinguish the documented stale-form gap. |
| Banking     | `encryptBank()` / `decryptBank()`        | Encryption and business/client context tests.                     |
| Attachments | `files()` / `DatabaseFiles`              | Cross-business rejection and exact multi-chunk reconstruction.    |
| Chat        | `/chat`, `snapshot()`, `testingAnswer()` | No external request in testing mode; excluded fields and limits.  |
| Reports     | `nextReportAt()`, `deliverReport()`      | DST cases, retry key reuse, overlapping sends.                    |
| Exports     | `invoiceWorkbook()`                      | Numeric cells and safe formula-like text.                         |

Before presenting a topic, explain it once without the script, then open the code and identify the lines responsible. If a follow-up is outside the implementation, say what the current code does and what would need investigation rather than guessing.

## Readiness check

Rehearse these without reading the answers first:

1. Draw the browser, Supabase, Worker, D1, and email provider, and label each connection.
2. Trace a new invoice and explain which checks happen in the browser and which happen on the server.
3. Explain why changing a business header cannot grant another business's records.
4. Work through the two-request version example, then identify the stale-form limitation.
5. Explain the difference between a public project key, a user token, and a bank encryption key.
6. Explain why an email timeout can leave the result uncertain and why retry keys help.
7. Show where testing chat returns before a provider call.
8. Identify two current limitations and propose a concrete change for each.
9. Open one test and explain its setup, action, assertion, and what it does not prove.
10. Describe your own contribution and AI assistance accurately, without claiming unperformed work.

For each, give a short answer, locate the responsible function, and handle one follow-up. Mark any answer that still depends on memorizing a sentence and return to that code path. The documentation is a reference; the ability to trace a fresh example is the stronger check of understanding.
