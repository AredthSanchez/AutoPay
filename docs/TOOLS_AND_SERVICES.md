# AutoPay tools and services

This inventory separates the current application, optional integrations, development tools, and the older source archive. A package being listed in the archive does not mean it powers the current app.

The current application is the source tree at the repository root. Exact direct dependency declarations come from [package.json](../package.json); resolved installed versions and transitive dependencies come from [package-lock.json](../package-lock.json). Hosting configuration is in [wrangler.jsonc](../wrangler.jsonc).

## How the tools fit together

AutoPay uses several tools because displaying a screen, saving records, checking a login, and sending email are different jobs.

| Job                                 | Tool               | What to remember                                                                                 |
| ----------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------ |
| Display the screens                 | React              | Builds the interactive forms, tables, and buttons in the browser.                                |
| Define behavior                     | JavaScript         | The language used to write instructions for the app. React is a library used from that language. |
| Style the screens                   | CSS                | Changes appearance, not access permissions or saved invoice data.                                |
| Handle requests                     | Cloudflare Workers | Runs the behind-the-scenes code that checks and saves information.                               |
| Keep business records               | Cloudflare D1      | Stores the organized lists of businesses, clients, and invoices.                                 |
| Check accounts and passwords        | Supabase Auth      | Manages login. AutoPay separately checks business membership.                                    |
| Send emails                         | Resend             | Receives email requests when sender settings are configured.                                     |
| Keep project history                | Git and GitHub     | Git records changes; GitHub hosts that history and the files.                                    |
| Run tools on a development computer | Node.js and npm    | Node runs JavaScript tools; npm installs packages and runs project commands.                     |
| Prepare the app for hosting         | Vite               | Builds the files that will be published.                                                         |
| Publish to Cloudflare               | Wrangler           | Sends the build and configuration to the hosting service.                                        |
| Generate optional AI answers        | OpenAI             | Only used when the paid mode is enabled. Testing mode does not call it.                          |

A **library** is reusable code the project imports. A **service** runs outside the codebase, such as the login or email provider. A **development tool** helps build or check the application. A **package** is an installable bundle of code; not every installed package was written specifically for AutoPay.

The tables below keep the exact technical names and versions for reference. The archived packages at the end belong to the earlier implementation, not the current app you are presenting.

## Languages and file formats

| Technology              | Where it is used                                             | What it does                                                                                                             |
| ----------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| JavaScript / ES modules | `.js` and `.mjs` files                                       | Browser behavior, server routes, calculations, storage adapters, reports, and tests. `import`/`export` connect files.    |
| JSX                     | React `.jsx` files                                           | Describes screen elements and connects them to JavaScript values and actions.                                            |
| HTML                    | `index.html`                                                 | Initial browser document, metadata, root element, and script entry.                                                      |
| CSS                     | `app/**/*.css`                                               | Layout, colors, spacing, dialogs, and mobile styles. The root app uses ordinary CSS.                                     |
| SQL / SQLite            | `drizzle/*.sql` and prepared queries                         | Creates tables and reads or changes business records.                                                                    |
| JSON                    | API messages, package/config files, invoice/client documents | Exchanges structured data and records configuration.                                                                     |
| SVG                     | `public/autopay-logo.svg`                                    | Logo and favicon artwork that scales without raster blur.                                                                |
| XML / OOXML             | Generated by `excel.js`                                      | Describes spreadsheet cells, styles, and relationships in XLSX exports.                                                  |
| ZIP / XLSX              | Export code and historical source archive                    | XLSX packages spreadsheet files in ZIP format; the source ZIP stores the older application.                              |
| Markdown / Mermaid      | `docs/*.md`                                                  | Repository documentation, tables, and architecture diagrams. Mermaid is a documentation renderer, not an app dependency. |

## Current application packages

The versions below are the declared requirements, not a promise that every ranged package always resolves to the same version. `npm ci` uses the lockfile for exact reproducibility.

| Package                   | Declared version | Role                                                                           | Where to look                          |
| ------------------------- | ---------------- | ------------------------------------------------------------------------------ | -------------------------------------- |
| `react`                   | `19.2.6`         | Components, state, effects, and screen updates.                                | `app/*.jsx`, `app/workspace/index.jsx` |
| `react-dom`               | `19.2.6`         | Renders React in the browser's page.                                           | `src/main.jsx`                         |
| `@supabase/supabase-js`   | `2.119.2`        | Browser account signup/login/recovery and session management.                  | `app/auth-shell.jsx`                   |
| `lucide-react`            | `^1.31.0`        | Interface icons.                                                               | Imports in screen components.          |
| `vite`                    | `8.0.13`         | Local development and builds.                                                  | `vite.config.js`, npm scripts.         |
| `@vitejs/plugin-react`    | `6.0.2`          | React integration for Vite.                                                    | `vite.config.js`                       |
| `@cloudflare/vite-plugin` | `1.37.1`         | Connects Vite to the Worker and Cloudflare bindings.                           | `vite.config.js`                       |
| `wrangler`                | `4.92.0`         | Cloudflare CLI for local/runtime tooling, deployment, migrations, and secrets. | `wrangler.jsonc`, npm scripts.         |

Packages such as bundlers, native platform packages, and Worker emulators can be installed as dependencies of these tools. They are not all separately selected application libraries. The complete resolved list is in the lockfile; `npm ls --all` shows the installed tree. Inspect a package's actual use before describing it as part of AutoPay's design.

## Hosting, storage, and outside services

| Tool/service                                | Status in this implementation                                                                | Responsibility                                                                                                                                               |
| ------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Cloudflare Workers                          | Current backend/hosting target.                                                              | Runs request handling, serves built assets, and executes scheduled work.                                                                                     |
| Cloudflare static assets / `ASSETS` binding | Current build configuration.                                                                 | Delivers the browser application and fallback HTML.                                                                                                          |
| Cloudflare D1 / `DB` binding                | Current business database.                                                                   | Accounts, memberships, invoices, clients, attachment chunks, email attempts, and schedules.                                                                  |
| Cloudflare Cron Triggers                    | Configured every 15 minutes.                                                                 | Invokes the scheduled report processor.                                                                                                                      |
| Cloudflare observability                    | Enabled in checked-in configuration.                                                         | Supports runtime logs and investigation; it is not a substitute for monitoring and alerting design.                                                          |
| Supabase Auth                               | Current identity integration.                                                                | Accounts, email/password login, confirmation, reset, and sessions. Business records remain in D1.                                                            |
| Resend                                      | Email integration in source.                                                                 | Sends new-invoice notices and scheduled reports when sender/secrets are configured. Current provider delivery must be verified separately.                   |
| OpenAI Responses API                        | Optional paid integration; disabled by checked-in testing mode.                              | Generates answers from a restricted snapshot when explicitly enabled with a server key. Default model in code is `gpt-5-mini`, with an environment override. |
| Cloudflare R2                               | Optional, not bound in current root configuration.                                           | Can replace D1-backed attachment bytes if a `BUCKET` binding and file migration are added.                                                                   |
| GitHub                                      | Current source/documentation repository.                                                     | Version history, code review, and access to the project. Source hosting is different from the running Cloudflare app.                                        |
| ChatGPT Sites                               | Earlier development/hosting stage.                                                           | Used to build and host earlier versions before the standalone Cloudflare/Supabase migration. The old Site is not the current Worker backend.                 |
| Twilio                                      | Present in the archived Java calling integration/setup references, not active in the Worker. | Would provide phone calls and the configured payment connector workflow in that separate implementation.                                                     |

Provider accounts, quotas, mail domain setup, and production secrets are operational configuration. A checked-in integration or a passing mock test does not prove a live account is configured or a message was delivered. This document does not assert current pricing or that hosting has no cost.

## Built-in browser and server capabilities

These are platform APIs used by the code, not npm libraries selected separately.

| Capability                                             | Role in AutoPay                                                                                       |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `fetch`, `Request`, `Response`, `Headers`              | Browser/server requests, JSON responses, and provider calls.                                          |
| `URL`, `URLSearchParams`                               | Routes, invitation/callback parameters, and URL construction.                                         |
| `AbortSignal.timeout`                                  | Bounds time spent waiting for provider requests.                                                      |
| `FormData`, `File`, `Blob`                             | File upload forms and downloaded/exported content.                                                    |
| `ReadableStream`                                       | Sends attachment chunks in order without returning the whole file at once.                            |
| Web Crypto / `crypto.subtle`                           | AES-GCM encryption and SHA-256 hashing; random values and UUIDs.                                      |
| `TextEncoder`, `TextDecoder`, typed arrays, `DataView` | Text/binary conversion, file chunks, and spreadsheet ZIP headers.                                     |
| `Intl.NumberFormat`                                    | USD display.                                                                                          |
| `Intl.DateTimeFormat` and `Date`                       | Local dates, timezone comparisons, report scheduling, and aging.                                      |
| `localStorage`, `sessionStorage`                       | Business choice, invitation flow, and browser session-related state. These are not permission checks. |
| Native `<dialog>`                                      | Centered forms with browser dialog behavior.                                                          |
| DOM events, timers, object URLs                        | Shortcuts, conditional refresh, temporary downloads, and screen interactions.                         |
| Node `node:test`, `node:assert/strict`                 | Automated test runner and assertions, without Jest/Vitest in the root package.                        |
| Node `node:sqlite`                                     | Temporary in-memory database for integration tests.                                                   |
| Node `node:fs` and other core modules                  | Configuration reading and development/test utilities.                                                 |

## Development and verification tools used during this project

| Tool                           | Use                                                                                                                                 | Part of the running app?                                                  |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| ChatGPT / Codex                | AI-assisted implementation, revisions, debugging, explanations, documentation, and test execution based on the user's requirements. | No. Optional OpenAI chat in the product is a separate integration.        |
| Git                            | Tracks revisions and compares changes.                                                                                              | No.                                                                       |
| GitHub connector/GitHub API    | Reads repository content and writes commits with branch-head checks.                                                                | No.                                                                       |
| Terminal / shell               | Runs Git, npm, builds, checks, and inspection scripts.                                                                              | No.                                                                       |
| Node.js                        | Runs development tools and tests. Package engines require Node 22.13 or later; the Cloudflare Worker remains its own runtime.       | Development/tests; do not describe production as a dedicated Node server. |
| npm                            | Installs packages and runs named project commands.                                                                                  | No.                                                                       |
| Wrangler CLI                   | Cloudflare setup, publishing, secrets, and D1 migrations.                                                                           | Tooling, not screen code.                                                 |
| Browser and developer tools    | View screens and inspect requests/console behavior.                                                                                 | Browser runs the frontend; developer tools are for investigation.         |
| `rg` / ripgrep                 | Searches source and documentation.                                                                                                  | No.                                                                       |
| Python standard library        | Repository inspection, ZIP inspection, and documentation/checking scripts during development.                                       | No Python application backend.                                            |
| Prettier                       | Applied source formatting during the repository cleanup.                                                                            | Not a root runtime dependency.                                            |
| Babel parser (`@babel/parser`) | Compared JavaScript/JSX structure while verifying formatting/comment-only changes.                                                  | Temporary verification tool, not app business logic.                      |
| PostCSS parser                 | Compared CSS rules during the formatting/comment checks.                                                                            | Temporary verification use; also may occur inside build dependencies.     |
| `sql-formatter`                | Formatted SQL while checking that statement tokens stayed unchanged.                                                                | Temporary cleanup tool.                                                   |
| Sites and Supabase connectors  | Project/hosting and identity-service setup during earlier development.                                                              | Development integrations, not browser dependencies.                       |

This is an evidence-based inventory of the current source and the tools visible in this project's development history. It does not claim that every package in a generated template was actively used or that every test was performed manually by the project owner.

## Earlier implementation in the source archive

`AutoPay-source.zip` contains an earlier Java backend, a frontend subproject, and a larger framework template. They are retained for reference, not used by the root build. The archive's Java dependency manifest declares:

| Tool/library                            | Archived role                                                                                                                              |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Java 21                                 | Backend language/runtime target.                                                                                                           |
| Maven                                   | Java build and dependency tool.                                                                                                            |
| Spring Boot 3.5.7                       | Java application framework.                                                                                                                |
| Spring Web                              | HTTP controllers.                                                                                                                          |
| Spring Data JPA                         | Database repository/persistence layer.                                                                                                     |
| Spring Validation                       | Request/entity validation support.                                                                                                         |
| Spring Security                         | Java security configuration.                                                                                                               |
| MySQL Connector/J                       | MySQL database driver.                                                                                                                     |
| H2                                      | Alternate embedded/testing database dependency.                                                                                            |
| Spring Boot Test / Spring Security Test | Java test dependencies.                                                                                                                    |
| Java HTTP client and Twilio REST/TwiML  | Calling/payment workflow in the archived voice service. Twilio is called over HTTP rather than through a declared Twilio Maven SDK.        |
| Docker                                  | A Dockerfile is present in the archive. Not required by the root Cloudflare app.                                                           |
| Docker Compose                          | Referenced by the voice setup screen; a Compose configuration is not present in the inspected archive. Not part of the current root build. |

The archive also declares the frontend/template packages listed below. A declaration records availability, not proof that the app uses the package. In particular, Next.js, Vinext, Tailwind, TypeScript tooling, Drizzle ORM, and Spring Boot should not be presented as the active root stack.

### Archived declaration: `autopay/frontend/package.json`

| Package                | Declared version | Group           |
| ---------------------- | ---------------- | --------------- |
| `react`                | `19.0.0`         | dependencies    |
| `react-dom`            | `19.0.0`         | dependencies    |
| `lucide-react`         | `0.468.0`        | dependencies    |
| `vite`                 | `6.1.0`          | devDependencies |
| `@vitejs/plugin-react` | `4.3.4`          | devDependencies |
| `tailwindcss`          | `4.0.9`          | devDependencies |
| `@tailwindcss/vite`    | `4.0.9`          | devDependencies |

### Archived declaration: `autopay/package.json`

| Package                     | Declared version | Group           |
| --------------------------- | ---------------- | --------------- |
| `@base-ui/react`            | `^1.7.0`         | dependencies    |
| `@hookform/resolvers`       | `^5.7.1`         | dependencies    |
| `@shadcn/react`             | `^0.3.0`         | dependencies    |
| `class-variance-authority`  | `0.7.1`          | dependencies    |
| `clsx`                      | `2.1.1`          | dependencies    |
| `cmdk`                      | `^1.1.1`         | dependencies    |
| `date-fns`                  | `^4.4.0`         | dependencies    |
| `drizzle-orm`               | `0.45.2`         | dependencies    |
| `embla-carousel-react`      | `^8.6.0`         | dependencies    |
| `input-otp`                 | `^1.4.2`         | dependencies    |
| `lucide-react`              | `^1.31.0`        | dependencies    |
| `next`                      | `16.3.4`         | dependencies    |
| `next-themes`               | `^0.4.6`         | dependencies    |
| `radix-ui`                  | `^1.6.7`         | dependencies    |
| `react`                     | `19.2.6`         | dependencies    |
| `react-day-picker`          | `^10.0.1`        | dependencies    |
| `react-dom`                 | `19.2.6`         | dependencies    |
| `react-hook-form`           | `^7.85.0`        | dependencies    |
| `react-resizable-panels`    | `^4.12.2`        | dependencies    |
| `recharts`                  | `^3.8.0`         | dependencies    |
| `sonner`                    | `^2.0.8`         | dependencies    |
| `tailwind-merge`            | `3.6.0`          | dependencies    |
| `vaul`                      | `^1.1.2`         | dependencies    |
| `zod`                       | `^3.25.76`       | dependencies    |
| `@cloudflare/vite-plugin`   | `1.37.1`         | devDependencies |
| `@cloudflare/workers-types` | `4.20260515.1`   | devDependencies |
| `@tailwindcss/postcss`      | `4.2.1`          | devDependencies |
| `@types/node`               | `22.19.19`       | devDependencies |
| `@types/react`              | `19.2.14`        | devDependencies |
| `@types/react-dom`          | `19.2.3`         | devDependencies |
| `@vitejs/plugin-react`      | `6.0.2`          | devDependencies |
| `@vitejs/plugin-rsc`        | `0.5.26`         | devDependencies |
| `drizzle-kit`               | `0.31.10`        | devDependencies |
| `eslint`                    | `9.39.4`         | devDependencies |
| `eslint-config-next`        | `16.3.4`         | devDependencies |
| `json-rpc-2.0`              | `1.7.1`          | devDependencies |
| `raw-body`                  | `3.0.2`          | devDependencies |
| `react-server-dom-webpack`  | `19.2.6`         | devDependencies |
| `tailwindcss`               | `4.2.1`          | devDependencies |
| `tw-animate-css`            | `^1.4.0`         | devDependencies |
| `typescript`                | `5.9.3`          | devDependencies |
| `vinext`                    | `1.0.0-beta.5`   | devDependencies |
| `vite`                      | `8.0.13`         | devDependencies |
| `wrangler`                  | `4.92.0`         | devDependencies |
