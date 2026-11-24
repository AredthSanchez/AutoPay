/**
 * Checks saved hosting identifiers, public login settings, and testing chat mode before
 * deployment.
 * Does not verify live database updates, installed secrets, or email delivery.
 */
import { readFileSync } from "node:fs";
import { authConfig } from "../worker/auth.mjs";
const config = JSON.parse(readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8"));
const errors = [];
if (!config.account_id) errors.push("Set your Cloudflare account_id in wrangler.jsonc.");
if (config.d1_databases?.[0]?.database_id === "00000000-0000-4000-8000-000000000000")
  errors.push("Create the AutoPay D1 database and set its database_id.");
if (!authConfig(config.vars || {}))
  errors.push(
    "Set the Supabase project URL and PUBLIC publishable key. Never use a service-role key.",
  );
if (config.vars?.AUTOPAY_CHAT_MODE !== "testing")
  errors.push("Keep AUTOPAY_CHAT_MODE=testing for this migration.");
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(
  "Cloudflare configuration is ready. Ensure all database migrations are applied before deployment. R2 is optional.",
);
