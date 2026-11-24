/**
 * Creates the temporary database and file storage used by automated tests. Builds requests for
 * different test users so access to each business can be checked.
 * Everything stays in the test environment; production business records are not used.
 */
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { serve } from "../lib/autopay/service.mjs";
export function setup({ env = {} } = {}) {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(
    readFileSync(new URL("../drizzle/0000_friendly_johnny_storm.sql", import.meta.url), "utf8"),
  );
  sqlite.exec(
    readFileSync(new URL("../drizzle/0001_lethal_madame_masque.sql", import.meta.url), "utf8"),
  );
  sqlite.exec(readFileSync(new URL("../drizzle/0002_lethal_fixer.sql", import.meta.url), "utf8"));
  sqlite.exec(
    readFileSync(new URL("../drizzle/0003_independent_identity.sql", import.meta.url), "utf8"),
  );
  for (const migration of [
    "0004_database_files.sql",
    "0005_bank_migration.sql",
    "0006_scheduled_reports.sql",
  ])
    sqlite.exec(readFileSync(new URL("../drizzle/" + migration, import.meta.url), "utf8"));
  const db = {
    prepare(sql) {
      const stmt = sqlite.prepare(sql);
      let args = [];
      return {
        bind(...values) {
          args = values;
          return this;
        },
        async first() {
          return stmt.get(...args) || null;
        },
        async all() {
          return { results: stmt.all(...args) };
        },
        async run() {
          const r = stmt.run(...args);
          return { meta: { changes: Number(r.changes) } };
        },
      };
    },
    async batch(statements) {
      sqlite.exec("BEGIN");
      try {
        const out = [];
        for (const q of statements) out.push(await q.run());
        sqlite.exec("COMMIT");
        return out;
      } catch (e) {
        sqlite.exec("ROLLBACK");
        throw e;
      }
    },
  };
  const objects = new Map(),
    bucket = {
      async put(key, body) {
        objects.set(key, await new Response(body).arrayBuffer());
      },
      async get(key) {
        const b = objects.get(key);
        return b ? { body: b } : null;
      },
      async delete(key) {
        objects.delete(key);
      },
    };
  const call = (
    user,
    path,
    { method = "GET", body, business, origin = "https://autopay.test", headers = {} } = {},
  ) =>
    serve(
      new Request("https://autopay.test/api" + path, {
        method,
        headers: {
          ...(body instanceof FormData ? {} : body ? { "Content-Type": "application/json" } : {}),
          "X-AutoPay-Request": "1",
          Origin: origin,
          ...(business ? { "X-AutoPay-Business": business } : {}),
          ...headers,
        },
        body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
      }),
      { db, bucket, user, env },
    );
  return { db, bucket, call, sqlite };
}
