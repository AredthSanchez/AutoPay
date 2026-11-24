/**
 * Exercises schedule validation, timezone/DST behavior, authorization, retry idempotency, and delivery leases.
 * Fixed times and mocked mail responses keep report tests repeatable without sending messages.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { setup } from "./helpers.mjs";
import {
  validateSchedule,
  nextReportAt,
  reportPayload,
  runScheduledReports,
  deliverReport,
} from "../lib/autopay/reports.mjs";
const owner = { userId: "report-owner", email: "owner@example.com", displayName: "Report owner" },
  other = { userId: "report-other", email: "other@example.com", displayName: "Other" },
  member = { userId: "report-member", email: "member@example.com", displayName: "Member" };
const settings = {
  recipient: "reports@example.com",
  enabled: true,
  frequency: "daily",
  sendTime: "09:00",
  timeZone: "America/Denver",
  weekday: 1,
};
async function register(call, user, name) {
  return (
    await (
      await call(user, "/auth/register", {
        method: "POST",
        body: { name: user.displayName, businessName: name },
      })
    ).json()
  ).businessId;
}
const draft = {
  client: "Shared Client",
  email: "private@example.com",
  phone: "",
  dueDate: "2026-11-01",
  notes: "Private note should not be sent",
  items: [{ description: "Work", quantity: 1, unitPrice: 100 }],
};
test("report schedules validate recipient, frequency, quarter-hour time and timezone", () => {
  assert.equal(validateSchedule(settings).recipient, "reports@example.com");
  for (const invalid of [
    { ...settings, recipient: "" },
    { ...settings, frequency: "" },
    { ...settings, sendTime: "09:13" },
    { ...settings, timeZone: "Not/AZone" },
    { ...settings, weekday: "" },
    { ...settings, enabled: "true" },
  ])
    assert.throws(() => validateSchedule(invalid));
  assert.equal(validateSchedule({ ...settings, enabled: false, recipient: "" }).recipient, "");
});
test("reports follow local timezone, weekly day, DST gaps and repeated-hour exclusion", () => {
  assert.equal(nextReportAt(settings, "2026-11-20T15:59:00Z"), "2026-11-20T16:00:00.000Z");
  assert.equal(nextReportAt(settings, "2026-11-20T16:00:00Z"), "2026-11-21T16:00:00.000Z");
  assert.equal(
    nextReportAt({ ...settings, frequency: "weekly", weekday: 1 }, "2026-11-20T17:00:00Z"),
    "2026-11-23T16:00:00.000Z",
  );
  assert.equal(
    nextReportAt({ ...settings, sendTime: "02:30" }, "2027-03-14T08:00:00Z"),
    "2027-03-15T08:30:00.000Z",
  );
  assert.equal(
    nextReportAt({ ...settings, sendTime: "01:30" }, "2026-11-01T07:30:00Z", "2026-11-01"),
    "2026-11-02T08:30:00.000Z",
  );
});
test("only owners manage report settings, tests and retries; listings stay business scoped", async () => {
  const { call, sqlite } = setup();
  try {
    const a = await register(call, owner, "A"),
      b = await register(call, other, "B");
    const invite = await (
      await call(owner, "/team/invite", {
        business: a,
        method: "POST",
        body: { email: member.email },
      })
    ).json();
    await call(member, "/auth/join", {
      method: "POST",
      body: { name: "Member", token: new URL(invite.url).searchParams.get("invite") },
    });
    assert.equal(
      (await call(member, "/report-settings", { business: a, method: "POST", body: settings }))
        .status,
      403,
    );
    assert.equal((await call(other, "/reports", { business: a })).status, 403);
    assert.equal(
      (await call(owner, "/report-settings", { business: a, method: "POST", body: settings }))
        .status,
      200,
    );
    const s = await (await call(member, "/report-settings", { business: a })).json();
    assert.equal(s.canManage, false);
    assert.equal(s.enabled, true);
    assert.ok(s.nextRun);
    assert.equal(
      (await call(member, "/report-settings/send", { business: a, method: "POST", body: {} }))
        .status,
      403,
    );
    const sent = await (
      await call(owner, "/report-settings/send", { business: a, method: "POST", body: {} })
    ).json();
    assert.equal(sent.status, "PENDING_SETUP");
    const rows = await (await call(owner, "/reports", { business: a })).json();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].recipient, settings.recipient);
    assert.equal(
      (
        await call(other, "/reports/" + rows[0].id + "/retry", {
          business: b,
          method: "POST",
          body: {},
        })
      ).status,
      404,
    );
    assert.equal((await (await call(other, "/reports", { business: b })).json()).length, 0);
  } finally {
    sqlite.close();
  }
});
test("scheduled report outbox is idempotent and excludes other businesses and sensitive fields", async () => {
  const { db, call, sqlite } = setup();
  const original = globalThis.fetch;
  try {
    const a = await register(call, owner, "Report Business"),
      b = await register(call, other, "Other Business");
    const invoice = await (
      await call(owner, "/invoices", { business: a, method: "POST", body: draft })
    ).json();
    await call(owner, "/invoices/" + invoice.id + "/flag", {
      business: a,
      method: "POST",
      body: { flagged: true },
    });
    await call(other, "/invoices", {
      business: b,
      method: "POST",
      body: { ...draft, client: "Secret Other Client" },
    });
    const payload = await reportPayload(
      db,
      { id: a, name: "Report Business" },
      settings.timeZone,
      "2026-11-20T16:00:00Z",
    );
    assert.match(payload.text, /Outstanding: \$100.00/);
    assert.match(payload.text, /Overdue: \$100.00/);
    assert.match(payload.text, /Needs attention: 1/);
    for (const secret of ["Secret Other Client", draft.notes, draft.email])
      assert.equal(payload.text.includes(secret), false);
    await call(owner, "/report-settings", { business: a, method: "POST", body: settings });
    sqlite
      .prepare("UPDATE report_schedules SET next_run=? WHERE business=?")
      .run("2026-11-20T16:00:00.000Z", a);
    let sends = 0;
    globalThis.fetch = async (url, options) => {
      sends++;
      assert.equal(url, "https://api.resend.com/emails");
      assert.deepEqual(JSON.parse(options.body).to, ["reports@example.com"]);
      assert.ok(options.headers["Idempotency-Key"].startsWith("autopay-report-scheduled-"));
      return Response.json({ id: "report-provider-id" });
    };
    const env = { RESEND_API_KEY: "fake-unit-test-only", MAIL_FROM_EMAIL: "sender@example.com" };
    await runScheduledReports(db, env, "2026-11-20T16:00:00.000Z");
    await runScheduledReports(db, env, "2026-11-20T16:00:00.000Z");
    assert.equal(sends, 1);
    assert.equal(sqlite.prepare("SELECT count(*) AS n FROM report_runs").get().n, 1);
    assert.equal(
      sqlite.prepare("SELECT next_run FROM report_schedules WHERE business=?").get(a).next_run,
      "2026-11-21T16:00:00.000Z",
    );
    assert.equal(sqlite.prepare("SELECT status FROM report_runs").get().status, "SENT");
  } finally {
    globalThis.fetch = original;
    sqlite.close();
  }
});
test("report retries reuse the idempotency key, respect test recipient and stop after 24 hours", async () => {
  const { db, call, sqlite } = setup();
  const original = globalThis.fetch;
  try {
    const a = await register(call, owner, "A");
    const at = "2026-11-20T16:00:00.000Z";
    sqlite
      .prepare(
        "INSERT INTO report_runs(id,business,recipient,scheduled_for,payload,created_at,next_attempt) VALUES(?,?,?,?,?,?,?)",
      )
      .run(
        "retry-report",
        a,
        "reports@example.com",
        at,
        JSON.stringify({ subject: "Report", text: "Safe summary" }),
        at,
        at,
      );
    let keys = [],
      sends = 0;
    globalThis.fetch = async (url, options) => {
      keys.push(options.headers["Idempotency-Key"]);
      sends++;
      return sends === 1 ? Response.json({}, { status: 503 }) : Response.json({ id: "accepted" });
    };
    const env = { RESEND_API_KEY: "test-only", MAIL_FROM_EMAIL: "sender@example.com" };
    assert.equal(
      (
        await deliverReport(
          db,
          { ...env, RESEND_TEST_RECIPIENT: "different@example.com" },
          "retry-report",
          at,
        )
      ).status,
      "PENDING_SETUP",
    );
    assert.equal(sends, 0);
    assert.equal((await deliverReport(db, env, "retry-report", at)).status, "FAILED");
    assert.equal((await deliverReport(db, env, "retry-report", at)).status, "SENT");
    assert.deepEqual(keys, ["autopay-report-retry-report", "autopay-report-retry-report"]);
    assert.equal((await deliverReport(db, env, "retry-report", at)).status, "SENT");
    assert.equal(sends, 2);
    sqlite.prepare("UPDATE report_runs SET status='FAILED' WHERE id='retry-report'").run();
    assert.equal(
      (await deliverReport(db, env, "retry-report", "2026-11-21T16:00:00.000Z")).status,
      "EXPIRED",
    );
    assert.equal(sends, 2);
  } finally {
    globalThis.fetch = original;
    sqlite.close();
  }
});
test("invoice lists expose accurate attachment counts without cross-business files", async () => {
  const { call, sqlite } = setup();
  try {
    const a = await register(call, owner, "A"),
      b = await register(call, other, "B");
    const i = await (
      await call(owner, "/invoices", { business: a, method: "POST", body: draft })
    ).json();
    const file = new FormData();
    file.append("file", new File(["receipt"], "receipt.txt"));
    assert.equal(
      (
        await call(owner, "/invoices/" + i.id + "/attachments", {
          business: a,
          method: "POST",
          body: file,
        })
      ).status,
      201,
    );
    const rows = await (await call(owner, "/invoices", { business: a })).json();
    assert.equal(rows[0].attachmentCount, 1);
    assert.equal((await (await call(other, "/invoices", { business: b })).json()).length, 0);
  } finally {
    sqlite.close();
  }
});

test("delivery lease prevents simultaneous report sends", async () => {
  const { db, call, sqlite } = setup();
  const original = globalThis.fetch;
  let release, started;
  const entered = new Promise((r) => (started = r)),
    gate = new Promise((r) => (release = r));
  try {
    const a = await register(call, owner, "A"),
      at = "2026-11-20T16:00:00.000Z";
    sqlite
      .prepare(
        "INSERT INTO report_runs(id,business,recipient,scheduled_for,payload,created_at,next_attempt) VALUES(?,?,?,?,?,?,?)",
      )
      .run(
        "leased-report",
        a,
        "reports@example.com",
        at,
        JSON.stringify({ subject: "Report", text: "Summary" }),
        at,
        at,
      );
    let sends = 0;
    globalThis.fetch = async () => {
      sends++;
      started();
      await gate;
      return Response.json({ id: "one-report" });
    };
    const env = { RESEND_API_KEY: "test-only", MAIL_FROM_EMAIL: "sender@example.com" },
      first = deliverReport(db, env, "leased-report", at);
    await entered;
    assert.equal((await deliverReport(db, env, "leased-report", at)).status, "SENDING");
    release();
    assert.equal((await first).status, "SENT");
    assert.equal(sends, 1);
  } finally {
    release();
    globalThis.fetch = original;
    sqlite.close();
  }
});
test("changing or pausing a schedule cancels queued reports for the old destination", async () => {
  const { db, call, sqlite } = setup();
  const original = globalThis.fetch;
  try {
    const a = await register(call, owner, "A"),
      at = new Date().toISOString();
    await call(owner, "/report-settings", { business: a, method: "POST", body: settings });
    sqlite
      .prepare(
        "INSERT INTO report_runs(id,business,recipient,scheduled_for,payload,created_at,next_attempt) VALUES(?,?,?,?,?,?,?)",
      )
      .run(
        "scheduled-old",
        a,
        "old@example.com",
        at,
        JSON.stringify({ subject: "Old", text: "Summary" }),
        at,
        at,
      );
    assert.equal(
      (
        await call(owner, "/report-settings", {
          business: a,
          method: "POST",
          body: { ...settings, enabled: false, recipient: "new@example.com" },
        })
      ).status,
      200,
    );
    assert.equal(
      sqlite.prepare("SELECT status FROM report_runs WHERE id='scheduled-old'").get().status,
      "CANCELLED",
    );
    let sends = 0;
    globalThis.fetch = async () => {
      sends++;
      return Response.json({ id: "unexpected" });
    };
    await runScheduledReports(
      db,
      { RESEND_API_KEY: "test-only", MAIL_FROM_EMAIL: "sender@example.com" },
      at,
    );
    assert.equal(sends, 0);
  } finally {
    globalThis.fetch = original;
    sqlite.close();
  }
});
