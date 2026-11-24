const stamp = () => new Date().toISOString();
const q = (db, sql, ...args) => db.prepare(sql).bind(...args);
const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function localParts(when, zone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      weekday: "short",
    })
      .formatToParts(new Date(when))
      .map((p) => [p.type, p.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
    weekday: weekdays.indexOf(parts.weekday),
  };
}
export function validateSchedule(input) {
  if (typeof input.enabled !== "boolean")
    throw Error("Choose whether scheduled reports are enabled.");
  const recipient = String(input.recipient || "")
    .trim()
    .toLowerCase();
  if (
    (input.enabled || recipient) &&
    (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient) || recipient.length > 200)
  )
    throw Error("Enter a valid report email.");
  if (!["daily", "weekly"].includes(input.frequency))
    throw Error("Choose daily or weekly reports.");
  if (!/^([01]\d|2[0-3]):(00|15|30|45)$/.test(input.sendTime))
    throw Error("Choose a delivery time in 15-minute increments.");
  const timeZone = String(input.timeZone || "");
  if (timeZone.length > 100) throw Error("Choose a valid timezone.");
  try {
    new Intl.DateTimeFormat("en", { timeZone }).format();
  } catch {
    throw Error("Choose a valid timezone.");
  }
  if (!Number.isInteger(input.weekday) || input.weekday < 0 || input.weekday > 6)
    throw Error("Choose a valid weekday.");
  return {
    recipient,
    enabled: input.enabled,
    frequency: input.frequency,
    sendTime: input.sendTime,
    timeZone,
    weekday: input.weekday,
  };
}
const normalize = (s) => ({
  frequency: s.frequency,
  sendTime: s.sendTime ?? s.send_time,
  timeZone: s.timeZone ?? s.time_zone,
  weekday: s.weekday,
});
export function nextReportAt(settings, after = stamp(), excludeDate = "") {
  const s = normalize(settings),
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: s.timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      weekday: "short",
    });
  let t = Math.floor(new Date(after).getTime() / 900000) * 900000 + 900000;
  for (let n = 0; n < 15 * 96; n++, t += 900000) {
    const p = Object.fromEntries(
        formatter.formatToParts(new Date(t)).map((p) => [p.type, p.value]),
      ),
      date = `${p.year}-${p.month}-${p.day}`;
    if (
      date !== excludeDate &&
      `${p.hour}:${p.minute}` === s.sendTime &&
      (s.frequency === "daily" || weekdays.indexOf(p.weekday) === Number(s.weekday))
    )
      return new Date(t).toISOString();
  }
  throw Error("Unable to find the next report delivery time.");
}
export async function reportPayload(db, business, zone = "America/Denver", when = stamp()) {
  const today = localParts(when, zone).date,
    end = new Date(today + "T00:00:00Z");
  end.setUTCDate(end.getUTCDate() + 7);
  const until = end.toISOString().slice(0, 10);
  const totals = await q(
    db,
    `SELECT count(*) AS count,coalesce(sum(CASE WHEN json_extract(data,'$.status')='OPEN' THEN round(json_extract(data,'$.total')*100) ELSE 0 END),0) AS open,coalesce(sum(CASE WHEN json_extract(data,'$.status')='PAID' THEN round(json_extract(data,'$.total')*100) ELSE 0 END),0) AS paid,coalesce(sum(CASE WHEN json_extract(data,'$.status')='OPEN' AND json_extract(data,'$.dueDate')<? THEN round(json_extract(data,'$.total')*100) ELSE 0 END),0) AS overdue,coalesce(sum(CASE WHEN json_extract(data,'$.flagged')=1 THEN 1 ELSE 0 END),0) AS attention,coalesce(sum(CASE WHEN json_extract(data,'$.status')='OPEN' AND json_extract(data,'$.dueDate') BETWEEN ? AND ? THEN 1 ELSE 0 END),0) AS upcoming FROM invoices WHERE owner=? AND deleted=0`,
    today,
    today,
    until,
    business.id,
  ).first();
  const clients = await q(
    db,
    "SELECT count(*) AS count FROM clients WHERE owner=?",
    business.id,
  ).first();
  const top = (
    await q(
      db,
      `SELECT json_extract(data,'$.client') AS client,sum(round(json_extract(data,'$.total')*100)) AS amount FROM invoices WHERE owner=? AND deleted=0 AND json_extract(data,'$.status')='OPEN' GROUP BY json_extract(data,'$.client') ORDER BY amount DESC LIMIT 5`,
      business.id,
    ).all()
  ).results;
  const money = (n) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(n) / 100);
  return {
    subject: `AutoPay report: ${business.name} (${today})`,
    text: [
      `Invoice report for ${business.name}`,
      `As of ${today} (${zone}). Current workspace totals, not period-only activity.`,
      "",
      `Invoices: ${totals.count}`,
      `Clients: ${clients.count}`,
      `Outstanding: ${money(totals.open)}`,
      `Recorded paid: ${money(totals.paid)}`,
      `Overdue: ${money(totals.overdue)}`,
      `Needs attention: ${totals.attention}`,
      `Open invoices due in the next 7 days: ${totals.upcoming}`,
      "",
      "Largest outstanding client balances:",
      ...(top.length ? top.map((c) => `${c.client}: ${money(c.amount)}`) : ["None."]),
      "",
      "Bank information, invoice notes, attachments, and client contact details are excluded.",
      "Open AutoPay: https://autopay.aredthsanchez.workers.dev/",
    ].join("\n"),
  };
}
export async function deliverReport(db, env, id, when = stamp()) {
  const run = await q(db, "SELECT * FROM report_runs WHERE id=?", id).first();
  if (!run) throw Error("Report not found.");
  if (run.status === "SENT") return { status: "SENT" };
  if (new Date(when) - new Date(run.created_at) >= 86400000) {
    await q(
      db,
      "UPDATE report_runs SET status='EXPIRED',error=? WHERE id=? AND status<>'SENT'",
      "Delivery was not confirmed within 24 hours. Send a new report instead of retrying this one.",
      id,
    ).run();
    return { status: "EXPIRED" };
  }
  const lease = new Date(new Date(when).getTime() + 300000).toISOString();
  const lock = await q(
    db,
    "UPDATE report_runs SET status='SENDING',attempts=attempts+1,lease_until=? WHERE id=? AND status<>'SENT' AND (status<>'SENDING' OR lease_until<?)",
    lease,
    id,
    when,
  ).run();
  if (!lock.meta.changes) return { status: "SENDING" };
  const finish = async (status, error = null, provider = null) => {
    await q(
      db,
      "UPDATE report_runs SET status=?,error=?,provider_id=?,lease_until=NULL,next_attempt=? WHERE id=?",
      status,
      error,
      provider,
      new Date(new Date(when).getTime() + 900000).toISOString(),
      id,
    ).run();
    return { status };
  };
  if (!env.RESEND_API_KEY || !env.MAIL_FROM_EMAIL)
    return finish("PENDING_SETUP", "Email sender is not configured.");
  if (
    env.RESEND_TEST_RECIPIENT &&
    run.recipient.toLowerCase() !== env.RESEND_TEST_RECIPIENT.toLowerCase()
  )
    return finish(
      "PENDING_SETUP",
      "The current test sender can send only to its configured inbox. Verify a sending domain to use another recipient.",
    );
  try {
    const payload = JSON.parse(run.payload),
      response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + env.RESEND_API_KEY,
          "Content-Type": "application/json",
          "Idempotency-Key": "autopay-report-" + run.id,
        },
        body: JSON.stringify({
          from: env.MAIL_FROM_EMAIL,
          to: [run.recipient],
          subject: payload.subject,
          text: payload.text,
        }),
        signal: AbortSignal.timeout(15000),
      });
    if (!response.ok)
      return finish(
        "FAILED",
        "The mail provider did not accept this report. Check the sender configuration and retry.",
      );
    const result = await response.json();
    return finish("SENT", null, result.id || null);
  } catch {
    return finish(
      "FAILED",
      "Delivery was not confirmed. This report will be retried with the same provider idempotency key.",
    );
  }
}
export async function runScheduledReports(db, env, when = stamp()) {
  const due = (
    await q(
      db,
      "SELECT s.*,b.name FROM report_schedules s JOIN businesses b ON b.id=s.business WHERE s.enabled=1 AND s.next_run<=? ORDER BY s.next_run LIMIT 20",
      when,
    ).all()
  ).results;
  for (const schedule of due) {
    const day = localParts(schedule.next_run, schedule.time_zone).date,
      id = "scheduled-" + schedule.business + "-" + day,
      payload = await reportPayload(
        db,
        { id: schedule.business, name: schedule.name },
        schedule.time_zone,
        when,
      ),
      next = nextReportAt(schedule, when, day);
    await db.batch([
      q(
        db,
        "INSERT INTO report_runs(id,business,recipient,scheduled_for,status,payload,created_at,next_attempt) SELECT ?,?,?,?,'PENDING',?,?,? WHERE EXISTS (SELECT 1 FROM report_schedules WHERE business=? AND enabled=1 AND next_run=? AND updated_at=?) ON CONFLICT(id) DO NOTHING",
        id,
        schedule.business,
        schedule.recipient,
        schedule.next_run,
        JSON.stringify(payload),
        when,
        when,
        schedule.business,
        schedule.next_run,
        schedule.updated_at,
      ),
      q(
        db,
        "UPDATE report_schedules SET next_run=? WHERE business=? AND next_run=? AND updated_at=?",
        next,
        schedule.business,
        schedule.next_run,
        schedule.updated_at,
      ),
    ]);
  }
  const pending = (
    await q(
      db,
      "SELECT id FROM report_runs WHERE status IN ('PENDING','FAILED','PENDING_SETUP','SENDING') AND attempts<5 AND next_attempt<=? AND (lease_until IS NULL OR lease_until<?) ORDER BY created_at LIMIT 20",
      when,
      when,
    ).all()
  ).results;
  for (const run of pending) await deliverReport(db, env, run.id, when);
  return { scheduled: due.length, attempted: pending.length };
}
