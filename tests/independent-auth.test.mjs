import test from "node:test";
import assert from "node:assert/strict";
import { authenticatedUser, authConfig, adoptMigratedIdentity } from "../worker/auth.mjs";
import { handle } from "../worker/index.mjs";
import { setup } from "./helpers.mjs";
const env = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
};
const user = {
  id: "verified-user",
  email: "owner@example.com",
  email_confirmed_at: "2026-11-20T00:00:00Z",
  user_metadata: { full_name: "Verified Owner", role: "OWNER" },
};
test("identity headers from the previous host never authenticate a request", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => {
    throw Error("should not fetch");
  };
  try {
    assert.equal(
      await authenticatedUser(
        new Request("https://app.example/api/auth/me", {
          headers: {
            "oai-authenticated-user-id": "forged",
            "oai-authenticated-user-email": "owner@example.com",
          },
        }),
        env,
      ),
      null,
    );
  } finally {
    globalThis.fetch = original;
  }
});
test("Supabase verifies tokens and only confirmed non-anonymous emails can access records", async () => {
  const original = globalThis.fetch;
  let payload = user;
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://example.supabase.co/auth/v1/user");
    assert.equal(options.headers.Authorization, "Bearer signed-token");
    return Response.json(payload);
  };
  try {
    const request = new Request("https://app.example/api/auth/me", {
      headers: { Authorization: "Bearer signed-token" },
    });
    const verified = await authenticatedUser(request, env);
    assert.equal(verified.userId, "verified-user");
    assert.equal(verified.role, undefined);
    payload = { ...user, email_confirmed_at: null };
    assert.equal(await authenticatedUser(request, env), null);
    payload = { ...user, is_anonymous: true };
    assert.equal(await authenticatedUser(request, env), null);
    globalThis.fetch = async () => new Response("", { status: 401 });
    assert.equal(await authenticatedUser(request, env), null);
    globalThis.fetch = async () => new Response("", { status: 503 });
    await assert.rejects(() => authenticatedUser(request, env), /unavailable/);
  } finally {
    globalThis.fetch = original;
  }
});
test("public configuration rejects secret keys and worker APIs fail closed without login", async () => {
  assert.equal(authConfig({ ...env, SUPABASE_PUBLISHABLE_KEY: "sb_secret_do-not-expose" }), null);
  const secret = await handle(new Request("https://app.example/api/public-config"), {
    ...env,
    SUPABASE_PUBLISHABLE_KEY: "sb_secret_do-not-expose",
  });
  assert.equal((await secret.text()).includes("sb_secret"), false);
  const response = await handle(new Request("https://app.example/api/invoices"), {
    ...env,
    DB: {},
    BUCKET: {},
  });
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("X-Frame-Options"), "DENY");
});
test("verified email can claim only its explicit imported account and preserve memberships", async () => {
  const { db, sqlite } = setup();
  sqlite
    .prepare("INSERT INTO accounts(id,email,name,created_at) VALUES(?,?,?,?)")
    .run("legacy-owner", "owner@example.com", "Existing Owner", "2026-10-01");
  sqlite
    .prepare("INSERT INTO businesses(id,name,owner_id,created_at) VALUES(?,?,?,?)")
    .run("business", "Existing Business", "legacy-owner", "2026-10-01");
  sqlite
    .prepare("INSERT INTO memberships(id,business,user_id,role) VALUES(?,?,?,?)")
    .run("member", "business", "legacy-owner", "OWNER");
  sqlite
    .prepare("INSERT INTO legacy_identity_links(email,old_user_id) VALUES(?,?)")
    .run("owner@example.com", "legacy-owner");
  await adoptMigratedIdentity(db, { userId: "stranger", email: "other@example.com" });
  assert.equal(sqlite.prepare("SELECT owner_id FROM businesses").get().owner_id, "legacy-owner");
  await adoptMigratedIdentity(db, { userId: "verified-new-id", email: "owner@example.com" });
  assert.equal(sqlite.prepare("SELECT owner_id FROM businesses").get().owner_id, "verified-new-id");
  assert.equal(sqlite.prepare("SELECT user_id FROM memberships").get().user_id, "verified-new-id");
  assert.equal(sqlite.prepare("SELECT name FROM accounts").get().name, "Existing Owner");
  await adoptMigratedIdentity(db, { userId: "verified-new-id", email: "owner@example.com" });
  await assert.rejects(
    () => adoptMigratedIdentity(db, { userId: "second-id", email: "owner@example.com" }),
    /already linked/,
  );
  sqlite.close();
});
