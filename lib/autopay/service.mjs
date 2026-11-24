/**
 * Business API for invoices, clients, team access, attachments, chat, and reports.
 * Checks login, business membership, permissions, and submitted fields before reading or
 * changing records.
 */
import { validateSchedule, nextReportAt, reportPayload, deliverReport } from "./reports.mjs";
import { testingAnswer } from "./testing-chat.mjs";
import { snapshot, answerChat } from "./chat.mjs";
import { encryptBank, decryptBank, validateBank } from "./bank.mjs";
import { total } from "../../app/workspace/domain.js";
const now = () => new Date().toISOString(),
  uuid = () => crypto.randomUUID();
export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const fail = (status, message) => {
  throw new ApiError(status, message);
};
const text = (v, max = 200, required = true) => {
  if (typeof v !== "string" || v.length > max || (required && !v.trim()))
    fail(400, "A required field is missing or too long.");
  return v.trim();
};
const email = (v) => {
  v = text(v, 200).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) fail(400, "Enter a valid email address.");
  return v;
};
const date = (v) => {
  if (
    typeof v !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(v) ||
    isNaN(Date.parse(v)) ||
    new Date(v).toISOString().slice(0, 10) !== v
  )
    fail(400, "Enter a valid date.");
  return v;
};
const phone = (v) => {
  v = text(v || "", 30, false);
  if (v && !/^\+[1-9][0-9]{7,14}$/.test(v))
    fail(400, "Use an international phone number such as +19155550100.");
  return v;
};
const methods = ["CHECK", "ACH", "BANK_TRANSFER", "CARD", "CASH", "OTHER", "DEMO"];
const json = (body, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
// Stop reading if an incoming request is too large. Do not rely only on the size the browser
// claims it will send.
async function bytes(request, max) {
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  let size = 0;
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > max) {
      await reader.cancel();
      fail(413, "Upload or request is too large.");
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let off = 0;
  for (const chunk of chunks) {
    out.set(chunk, off);
    off += chunk.length;
  }
  return out;
}
async function body(request) {
  try {
    return JSON.parse(new TextDecoder().decode(await bytes(request, 65536)));
  } catch (e) {
    if (e instanceof ApiError) throw e;
    fail(400, "Invalid JSON request.");
  }
}
const sha = async (value) =>
  Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))))
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
export class AutoPayService {
  constructor(db, bucket, user, env = {}) {
    this.db = db;
    this.bucket = bucket;
    this.user = user;
    this.env = env;
    this.business = null;
    this.role = null;
  }
  q(sql, ...args) {
    return this.db.prepare(sql).bind(...args);
  }
  async auth() {
    if (!this.user?.userId || !this.user.email) fail(401, "Sign in to continue.");
    return this.user;
  }
  async account() {
    await this.auth();
    return this.q("SELECT * FROM accounts WHERE id=?", this.user.userId).first();
  }
  async workspaces() {
    await this.auth();
    return (
      await this.q(
        "SELECT b.id,b.name,b.owner_id,m.role FROM businesses b JOIN memberships m ON b.id=m.business WHERE m.user_id=? ORDER BY b.created_at",
        this.user.userId,
      ).all()
    ).results;
  }
  // Check that the logged-in person belongs to the requested business before using any of that
  // business's records.
  async scope(id) {
    await this.auth();
    const row = await this.q(
      "SELECT b.*,m.role FROM businesses b JOIN memberships m ON b.id=m.business WHERE b.id=? AND m.user_id=?",
      id || "",
      this.user.userId,
    ).first();
    if (!row) fail(403, "You are not a member of this business.");
    this.business = row;
    this.role = row.role;
    return row;
  }
  owner() {
    if (this.role !== "OWNER") fail(403, "Only the business owner can manage this setting.");
  }
  // Find the invoice by both its ID and the selected business. Knowing another business's
  // invoice ID must not give access to it.
  async invoice(id, deleted = false) {
    const row = await this.q(
      "SELECT * FROM invoices WHERE id=? AND owner=? AND deleted=?",
      id,
      this.business.id,
      deleted ? 1 : 0,
    ).first();
    if (!row) fail(404, "Invoice not found.");
    return { row, data: JSON.parse(row.data) };
  }
  // Save only if nobody has changed this invoice since it was loaded. If a teammate saved
  // first, return a conflict so their changes are not overwritten.
  async writeInvoice(row, data) {
    const result = await this.q(
      "UPDATE invoices SET data=?,number=?,deleted=?,version=version+1 WHERE id=? AND owner=? AND version=?",
      JSON.stringify(data),
      data.number,
      data.deleted ? 1 : 0,
      row.id,
      this.business.id,
      row.version,
    ).run();
    if (!result.meta.changes)
      fail(409, "Another team member changed this invoice. Refresh and try again.");
    return data;
  }
  event(i, message) {
    i.activity.push(now() + " | " + message + " · " + this.user.email);
  }
  draft(d) {
    const items = d.items;
    if (!Array.isArray(items) || items.length > 50 || !items.length)
      fail(400, "Add 1-50 invoice items.");
    const normalized = items.map((i) => ({
      description: text(i.description, 250),
      quantity: Number(i.quantity),
      unitPrice: Number(i.unitPrice),
    }));
    let amount;
    try {
      amount = total(normalized);
    } catch (e) {
      fail(400, e.message);
    }
    return {
      client: text(d.client, 150),
      email: email(d.email),
      phone: phone(d.phone),
      dueDate: date(d.dueDate),
      notes: text(d.notes || "", 2000, false),
      items: normalized,
      total: amount,
    };
  }
  async sendNotice(id) {
    this.owner();
    return this.deliverNotice(id);
  }
  // Remember whether this invoice email was sent. Give repeat attempts the same notification ID
  // so the email provider can avoid sending duplicates.
  async deliverNotice(id) {
    const n = await this.q(
      "SELECT * FROM notifications WHERE id=? AND owner=?",
      id,
      this.business.id,
    ).first();
    if (!n) fail(404, "Notification not found.");
    if (n.status === "SENT") return { status: "SENT" };
    if (
      this.env.RESEND_TEST_RECIPIENT &&
      n.recipient.toLowerCase() !== this.env.RESEND_TEST_RECIPIENT.toLowerCase()
    ) {
      await this.q(
        "UPDATE notifications SET status=?,error=? WHERE id=? AND owner=?",
        "PENDING_SETUP",
        "The current Resend test sender can send only to the configured account inbox. Verify a sending domain to notify other recipients.",
        id,
        this.business.id,
      ).run();
      return { status: "PENDING_SETUP" };
    }
    if (!this.env.RESEND_API_KEY || !this.env.MAIL_FROM_EMAIL) {
      await this.q(
        "UPDATE notifications SET status=?,error=? WHERE id=? AND owner=?",
        "PENDING_SETUP",
        "Email sender is not configured.",
        id,
        this.business.id,
      ).run();
      return { status: "PENDING_SETUP" };
    }
    const lock = await this.q(
      "UPDATE notifications SET status='SENDING',attempts=attempts+1,last_attempt=? WHERE id=? AND owner=? AND status IN ('PENDING','PENDING_SETUP','FAILED')",
      now(),
      id,
      this.business.id,
    ).run();
    if (!lock.meta.changes) fail(409, "Notification is already being sent.");
    try {
      const payload = JSON.parse(n.payload);
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + this.env.RESEND_API_KEY,
          "Content-Type": "application/json",
          "Idempotency-Key": "autopay-" + n.id,
        },
        body: JSON.stringify({
          from: this.env.MAIL_FROM_EMAIL,
          to: [n.recipient],
          subject: payload.subject,
          text: payload.text,
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error("Mail provider rejected the request.");
      const data = await response.json();
      await this.q(
        "UPDATE notifications SET status='SENT',provider_id=?,error=NULL WHERE id=? AND owner=?",
        data.id || "",
        id,
        this.business.id,
      ).run();
      return { status: "SENT" };
    } catch {
      await this.q(
        "UPDATE notifications SET status='FAILED',error=? WHERE id=? AND owner=?",
        "Delivery was not confirmed. Retry after checking the mail provider.",
        id,
        this.business.id,
      ).run();
      return { status: "FAILED" };
    }
  }
  async handle(request) {
    const url = new URL(request.url),
      path = url.pathname
        .replace(/^\/api/, "")
        .split("/")
        .filter(Boolean),
      method = request.method;
    await this.auth();
    if (method !== "GET") {
      if (request.headers.get("X-AutoPay-Request") !== "1") fail(403, "Invalid request.");
      const origin = request.headers.get("Origin");
      if (origin && origin !== url.origin) fail(403, "Cross-origin requests are not allowed.");
      if (request.headers.get("Sec-Fetch-Site") === "cross-site")
        fail(403, "Cross-site requests are not allowed.");
    }
    if (path[0] === "auth" && path[1] === "me" && method === "GET")
      return json({
        identity: this.user,
        account: await this.account(),
        businesses: await this.workspaces(),
      });
    if (path[0] === "auth" && path[1] === "register" && method === "POST") {
      const d = await body(request),
        name = text(d.name, 120),
        businessName = text(d.businessName, 150);
      const id = uuid();
      const ownerName = text(d.ownerName || name, 120);
      const account = await this.account();
      await this.db.batch([
        this.q(
          "INSERT INTO accounts(id,email,name,created_at) VALUES(?,?,?,?) ON CONFLICT(id) DO NOTHING",
          this.user.userId,
          this.user.email.toLowerCase(),
          name,
          now(),
        ),
        this.q(
          "INSERT INTO businesses(id,name,owner_id,created_at,owner_name,notification_email,notifications_enabled) VALUES(?,?,?,?,?,?,?)",
          id,
          businessName,
          this.user.userId,
          now(),
          ownerName,
          this.user.email.toLowerCase() === String(this.env.INITIAL_OWNER_EMAIL || "").toLowerCase()
            ? this.env.INITIAL_NOTIFICATION_EMAIL || null
            : null,
          this.user.email.toLowerCase() ===
            String(this.env.INITIAL_OWNER_EMAIL || "").toLowerCase() &&
            this.env.INITIAL_NOTIFICATION_EMAIL
            ? 1
            : 0,
        ),
        this.q(
          "INSERT INTO memberships(id,business,user_id,role) VALUES(?,?,?,?)",
          uuid(),
          id,
          this.user.userId,
          "OWNER",
        ),
      ]);
      return json({ businessId: id }, 201);
    }
    if (path[0] === "auth" && path[1] === "join" && method === "POST") {
      const d = await body(request),
        hash = await sha(text(d.token, 200));
      const invite = await this.q(
        "SELECT * FROM invites WHERE token_hash=? AND used_at IS NULL AND expires_at>?",
        hash,
        now(),
      ).first();
      if (!invite || invite.email.toLowerCase() !== this.user.email.toLowerCase())
        fail(403, "This invitation is invalid, expired, used, or addressed to another email.");
      const name = text(d.name || this.user.displayName || this.user.email, 120);
      const member = await this.q(
        "SELECT id FROM memberships WHERE business=? AND user_id=?",
        invite.business,
        this.user.userId,
      ).first();
      if (member) return json({ businessId: invite.business });
      await this.db.batch([
        this.q(
          "INSERT INTO accounts(id,email,name,created_at) VALUES(?,?,?,?) ON CONFLICT(id) DO NOTHING",
          this.user.userId,
          this.user.email.toLowerCase(),
          name,
          now(),
        ),
        this.q(
          "INSERT INTO memberships(id,business,user_id,role) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM invites WHERE id=? AND used_at IS NULL AND expires_at>?)",
          uuid(),
          invite.business,
          this.user.userId,
          "MEMBER",
          invite.id,
          now(),
        ),
        this.q("UPDATE invites SET used_at=? WHERE id=? AND used_at IS NULL", now(), invite.id),
      ]);
      return json({ businessId: invite.business });
    }
    if (path[0] === "auth" && path[1] === "profile" && method === "POST") {
      const d = await body(request),
        name = text(d.name, 120);
      await this.q("UPDATE accounts SET name=? WHERE id=?", name, this.user.userId).run();
      return json({ saved: true });
    }
    // Account setup above can run before a business is chosen. Every request below this point
    // must first pass the business-membership check.
    await this.scope(request.headers.get("X-AutoPay-Business"));
    if (path[0] === "chat") {
      const testing = this.env.AUTOPAY_CHAT_MODE !== "openai";
      if (method === "GET")
        return json({
          mode: testing ? "testing" : "openai",
          configured: testing || !!this.env.OPENAI_API_KEY,
          canManage: this.role === "OWNER",
          businessName: this.business.name,
        });
      if (method !== "POST") fail(405, "Method not allowed.");
      if (!testing && !this.env.OPENAI_API_KEY)
        fail(
          503,
          "AI summaries are not connected yet. The site owner must add OPENAI_API_KEY as a server secret.",
        );
      const d = await body(request);
      if (!Array.isArray(d.messages) || !d.messages.length || d.messages.length > 9)
        fail(400, "Send a question with at most eight earlier messages.");
      const messages = d.messages.map((m) => {
        if (!["user", "assistant"].includes(m.role)) fail(400, "Invalid chat message.");
        return { role: m.role, content: text(m.content, 4000) };
      });
      if (messages.at(-1).role !== "user") fail(400, "Send a question.");
      if (messages.reduce((n, m) => n + m.content.length, 0) > 18000)
        fail(400, "This conversation is too long. Start a new chat.");
      const invoiceRows = (
          await this.q(
            "SELECT id,data FROM invoices WHERE owner=? AND deleted=0 ORDER BY created_at DESC LIMIT 1001",
            this.business.id,
          ).all()
        ).results,
        clientRows = (
          await this.q(
            "SELECT id,data FROM clients WHERE owner=? ORDER BY id LIMIT 1001",
            this.business.id,
          ).all()
        ).results;
      if (invoiceRows.length > 1000 || clientRows.length > 1000)
        fail(
          413,
          "This workspace is too large for the current assistant. Contact the site owner to enable a larger reporting workflow.",
        );
      const context = snapshot(
        invoiceRows,
        clientRows,
        this.business.name,
        undefined,
        testing ? 1000 : 200,
      );
      // In free testing mode, answer here without contacting OpenAI or using its paid-question
      // allowance, even if an API key is installed.
      if (testing)
        return json({
          answer: testingAnswer(context, messages),
          mode: "testing",
          asOf: context.asOfUTC,
          coverage: context.coverage,
        });
      const hour = new Date().toISOString().slice(0, 13),
        limit = await this.q(
          "INSERT INTO ai_usage(business,hour,requests) VALUES(?,?,1) ON CONFLICT(business,hour) DO UPDATE SET requests=requests+1 WHERE requests<30 RETURNING requests",
          this.business.id,
          hour,
        ).first();
      if (!limit)
        fail(
          429,
          "This business has reached its limit of 30 AI questions per hour. Try again next hour.",
        );
      const daily = await this.q(
        "INSERT INTO ai_usage(business,hour,requests) VALUES(?,?,1) ON CONFLICT(business,hour) DO UPDATE SET requests=requests+1 WHERE requests<200 RETURNING requests",
        "__site_daily__",
        hour.slice(0, 10),
      ).first();
      if (!daily) fail(429, "The site has reached its daily AI limit. Try again tomorrow.");
      if (JSON.stringify(context).length > 180000)
        fail(413, "This workspace has too much detail for one AI summary. Contact the site owner.");
      try {
        return json({
          answer: await answerChat(this.env, context, messages),
          mode: "openai",
          asOf: context.asOfUTC,
          coverage: context.coverage,
        });
      } catch (e) {
        fail(
          e.status || 503,
          e.status ? e.message : "The AI request timed out or failed. Please try again.",
        );
      }
    }
    if (path[0] === "business-profile") {
      if (method === "GET")
        return json({
          name: this.business.name,
          ownerName: this.business.owner_name,
          address: this.business.address,
          phone: this.business.phone,
          website: this.business.website,
          canManage: this.role === "OWNER",
        });
      this.owner();
      const d = await body(request);
      const values = [
        text(d.name, 150),
        text(d.ownerName, 120),
        text(d.address || "", 500, false),
        phone(d.phone),
        text(d.website || "", 250, false),
        this.business.id,
      ];
      await this.q(
        "UPDATE businesses SET name=?,owner_name=?,address=?,phone=?,website=? WHERE id=?",
        ...values,
      ).run();
      return json({ saved: true });
    }

    if (path[0] === "session" && method === "GET")
      return json({
        csrfHeader: "X-AutoPay-Request",
        csrfToken: "1",
        live: false,
        account: await this.account(),
        business: { id: this.business.id, name: this.business.name, role: this.role },
        voiceSetup: {
          backend: false,
          accountSid: false,
          authToken: false,
          fromNumber: false,
          payConnector: false,
          publicUrl: true,
          enabled: false,
        },
      });
    if (path[0] === "team" && method === "GET")
      return json({
        business: { id: this.business.id, name: this.business.name, role: this.role },
        members: (
          await this.q(
            "SELECT a.name,a.email,m.role,m.user_id AS id FROM memberships m JOIN accounts a ON a.id=m.user_id WHERE m.business=?",
            this.business.id,
          ).all()
        ).results,
        invites:
          this.role === "OWNER"
            ? (
                await this.q(
                  "SELECT id,email,expires_at,used_at FROM invites WHERE business=? ORDER BY created_at DESC LIMIT 30",
                  this.business.id,
                ).all()
              ).results
            : [],
      });
    if (path[0] === "team" && path[1] === "invite" && method === "POST") {
      this.owner();
      const d = await body(request),
        target = email(d.email);
      const token = uuid() + uuid();
      const id = uuid(),
        expires = new Date(Date.now() + 7 * 86400000).toISOString();
      await this.q(
        "INSERT INTO invites(id,business,email,token_hash,created_at,expires_at) VALUES(?,?,?,?,?,?)",
        id,
        this.business.id,
        target,
        await sha(token),
        now(),
        expires,
      ).run();
      return json(
        {
          url: url.origin + "/signup?invite=" + encodeURIComponent(token),
          email: target,
          expiresAt: expires,
        },
        201,
      );
    }
    // These report settings belong to the selected business. Only its owner may change them or
    // request a send.
    if (path[0] === "report-settings") {
      const saved = await this.q(
        "SELECT * FROM report_schedules WHERE business=?",
        this.business.id,
      ).first();
      if (method === "GET")
        return json({
          recipient: saved ? saved.recipient : this.business.notification_email || this.user.email,
          enabled: !!saved?.enabled,
          frequency: saved?.frequency || "daily",
          sendTime: saved?.send_time || "09:00",
          timeZone: saved?.time_zone || "America/Denver",
          weekday: saved?.weekday ?? 1,
          nextRun: saved?.next_run || null,
          canManage: this.role === "OWNER",
          senderConfigured: !!(this.env.RESEND_API_KEY && this.env.MAIL_FROM_EMAIL),
          testRecipient: this.env.RESEND_TEST_RECIPIENT || null,
        });
      this.owner();
      if (path[1] === "send") {
        if (!saved?.recipient) fail(400, "Save a report recipient first.");
        const recent = await this.q(
          "SELECT count(*) AS n FROM report_runs WHERE business=? AND created_at>?",
          this.business.id,
          new Date(Date.now() - 3600000).toISOString(),
        ).first();
        if (recent.n >= 3) fail(429, "Only three reports can be requested per hour.");
        const id = uuid(),
          payload = await reportPayload(this.db, this.business, saved.time_zone);
        await this.q(
          "INSERT INTO report_runs(id,business,recipient,scheduled_for,status,payload,created_at,next_attempt) VALUES(?,?,?,?,'PENDING',?,?,?)",
          id,
          this.business.id,
          saved.recipient,
          now(),
          JSON.stringify(payload),
          now(),
          now(),
        ).run();
        return json(await deliverReport(this.db, this.env, id));
      }
      let settings;
      try {
        settings = validateSchedule(await body(request));
      } catch (e) {
        fail(400, e.message);
      }
      const next = settings.enabled ? nextReportAt(settings) : null;
      await this.db.batch([
        this.q(
          "INSERT INTO report_schedules(business,recipient,enabled,frequency,send_time,time_zone,weekday,next_run,updated_at) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(business) DO UPDATE SET recipient=excluded.recipient,enabled=excluded.enabled,frequency=excluded.frequency,send_time=excluded.send_time,time_zone=excluded.time_zone,weekday=excluded.weekday,next_run=excluded.next_run,updated_at=excluded.updated_at",
          this.business.id,
          settings.recipient,
          settings.enabled ? 1 : 0,
          settings.frequency,
          settings.sendTime,
          settings.timeZone,
          settings.weekday,
          next,
          now(),
        ),
        this.q(
          "UPDATE report_runs SET status='CANCELLED',error='Cancelled after report settings changed.' WHERE business=? AND id LIKE 'scheduled-%' AND status IN ('PENDING','FAILED','PENDING_SETUP')",
          this.business.id,
        ),
      ]);
      return json({ saved: true, nextRun: next });
    }
    if (path[0] === "reports") {
      if (method === "GET")
        return json(
          (
            await this.q(
              "SELECT id,recipient,scheduled_for,status,created_at,attempts,error FROM report_runs WHERE business=? ORDER BY created_at DESC LIMIT 20",
              this.business.id,
            ).all()
          ).results,
        );
      this.owner();
      if (path[2] !== "retry") fail(404, "Route not found.");
      const run = await this.q(
        "SELECT id,status FROM report_runs WHERE id=? AND business=?",
        path[1],
        this.business.id,
      ).first();
      if (!run) fail(404, "Report not found.");
      if (!["FAILED", "PENDING_SETUP", "PENDING", "SENDING", "SENT"].includes(run.status))
        fail(409, "This report can no longer be retried. Send a new report.");
      return json(await deliverReport(this.db, this.env, run.id));
    }
    if (path[0] === "notification-settings") {
      if (method === "GET")
        return json({
          email: this.business.notification_email || "",
          enabled: !!this.business.notifications_enabled,
          senderConfigured: !!(this.env.RESEND_API_KEY && this.env.MAIL_FROM_EMAIL),
          testRecipient: this.env.RESEND_TEST_RECIPIENT || null,
          canManage: this.role === "OWNER",
        });
      this.owner();
      const d = await body(request),
        recipient = d.enabled ? email(d.email) : d.email ? email(d.email) : "";
      await this.q(
        "UPDATE businesses SET notification_email=?,notifications_enabled=? WHERE id=?",
        recipient,
        d.enabled ? 1 : 0,
        this.business.id,
      ).run();
      return json({ saved: true });
    }
    if (path[0] === "notifications") {
      if (method === "GET")
        return json(
          (
            await this.q(
              "SELECT id,invoice,recipient,status,created_at,attempts,error FROM notifications WHERE owner=? ORDER BY created_at DESC LIMIT 50",
              this.business.id,
            ).all()
          ).results,
        );
      if (path[2] === "retry" && method === "POST") return json(await this.sendNotice(path[1]));
    }
    // Check that this client belongs to the selected business before reading or changing their
    // profile or bank details.
    if (path[0] === "clients" && path[1]) {
      const client = await this.q(
        "SELECT * FROM clients WHERE id=? AND owner=?",
        path[1],
        this.business.id,
      ).first();
      if (!client) fail(404, "Client not found.");
      if (path[2] === "bank") {
        this.owner();
        if (method === "GET")
          return json({
            details: client.bank_needs_reentry
              ? null
              : await decryptBank(
                  client.bank_cipher,
                  this.env.BANK_DATA_KEY,
                  this.business.id,
                  client.id,
                ),
            requiresReentry: !!client.bank_needs_reentry,
            configured: !!this.env.BANK_DATA_KEY,
          });
        const d = await body(request);
        if (d.remove) {
          await this.q(
            "UPDATE clients SET bank_cipher=NULL,bank_last4=NULL,bank_needs_reentry=0 WHERE id=? AND owner=?",
            client.id,
            this.business.id,
          ).run();
          return json({ saved: true });
        }
        const bank = validateBank(d);
        const cipher = await encryptBank(bank, this.env.BANK_DATA_KEY, this.business.id, client.id);
        await this.q(
          "UPDATE clients SET bank_cipher=?,bank_last4=?,bank_needs_reentry=0 WHERE id=? AND owner=?",
          cipher,
          bank.accountNumber.slice(-4),
          client.id,
          this.business.id,
        ).run();
        return json({ saved: true, last4: bank.accountNumber.slice(-4) });
      }
      if (method === "POST") {
        const d = await body(request),
          data = {
            id: client.id,
            name: text(d.name, 150),
            email: email(d.email),
            phone: phone(d.phone),
            notes: text(d.notes || "", 2000, false),
            address: text(d.address || "", 500, false),
            contactName: text(d.contactName || "", 150, false),
            website: text(d.website || "", 250, false),
          };
        await this.q(
          "UPDATE clients SET email=?,data=? WHERE id=? AND owner=?",
          data.email,
          JSON.stringify(data),
          client.id,
          this.business.id,
        ).run();
        return json(data);
      }
    }
    if (path[0] === "clients") {
      if (method === "GET") {
        const all = (
          await this.q(
            "SELECT id,data,bank_last4 FROM clients WHERE owner=?",
            this.business.id,
          ).all()
        ).results.map((r) => ({
          ...JSON.parse(r.data),
          id: r.id,
          bankLast4: r.bank_last4,
          canManageBank: this.role === "OWNER",
        }));
        const map = new Map(all.map((c) => [c.email, c]));
        for (const row of (
          await this.q("SELECT data FROM invoices WHERE owner=?", this.business.id).all()
        ).results) {
          const i = JSON.parse(row.data);
          if (!map.has(i.email))
            map.set(i.email, {
              id: i.email,
              name: i.client,
              email: i.email,
              phone: i.phone,
              notes: "",
            });
        }
        return json([...map.values()].sort((a, b) => a.name.localeCompare(b.name)));
      }
      if (method === "POST") {
        const d = await body(request),
          c = {
            id: uuid(),
            name: text(d.name, 150),
            email: email(d.email),
            phone: phone(d.phone),
            notes: text(d.notes || "", 2000, false),
            address: text(d.address || "", 500, false),
            contactName: text(d.contactName || "", 150, false),
            website: text(d.website || "", 250, false),
          };
        const duplicate = await this.q(
          "SELECT id FROM clients WHERE owner=? AND email=?",
          this.business.id,
          c.email,
        ).first();
        if (duplicate) fail(409, "A client with that email already exists.");
        await this.q(
          "INSERT INTO clients(id,owner,email,data) VALUES(?,?,?,?)",
          c.id,
          this.business.id,
          c.email,
          JSON.stringify(c),
        ).run();
        return json(c, 201);
      }
    }
    if (path[0] === "invoices") {
      if ((path.length === 1 || path[1] === "trash") && method === "GET")
        return json(
          (
            await this.q(
              "SELECT i.data,(SELECT count(*) FROM attachments a WHERE a.owner=i.owner AND a.invoice=i.id) AS attachment_count FROM invoices i WHERE i.owner=? AND i.deleted=? ORDER BY i.created_at DESC",
              this.business.id,
              path[1] === "trash" ? 1 : 0,
            ).all()
          ).results.map((r) => ({ ...JSON.parse(r.data), attachmentCount: r.attachment_count })),
        );
      if (path.length === 1 && method === "POST") {
        const d = await body(request),
          i = {
            ...this.draft(d),
            id: uuid(),
            status: "OPEN",
            createdAt: now(),
            activity: [],
            deleted: false,
          };
        i.number = "INV-" + i.id.slice(0, 8).toUpperCase();
        this.event(i, "Invoice created");
        const insert = this.q(
          "INSERT INTO invoices(id,owner,number,data,created_at) VALUES(?,?,?,?,?)",
          i.id,
          this.business.id,
          i.number,
          JSON.stringify(i),
          i.createdAt,
        );
        const clientInsert = this.q(
          "INSERT INTO clients(id,owner,email,data) VALUES(?,?,?,?) ON CONFLICT(owner,email) DO NOTHING",
          uuid(),
          this.business.id,
          i.email,
          JSON.stringify({
            id: "",
            name: i.client,
            email: i.email,
            phone: i.phone,
            notes: "",
            address: "",
            contactName: "",
            website: "",
          }),
        );
        let notice;
        if (this.business.notifications_enabled && this.business.notification_email) {
          const count = await this.q(
            "SELECT count(*) AS n FROM notifications WHERE owner=? AND created_at>?",
            this.business.id,
            new Date(Date.now() - 3600000).toISOString(),
          ).first();
          if (count.n >= 30) fail(429, "This business has reached its hourly notification limit.");
          notice = {
            id: uuid(),
            recipient: this.business.notification_email,
            status: "PENDING",
            payload: JSON.stringify({
              subject: "New invoice " + i.number + "  -  " + this.business.name,
              text:
                "A new invoice was created in " +
                this.business.name +
                ".\n\nInvoice: " +
                i.number +
                "\nClient: " +
                i.client +
                "\nAmount: USD " +
                i.total.toFixed(2) +
                "\nDue date: " +
                i.dueDate +
                "\nCreated by: " +
                this.user.email +
                "\n\nOpen your business workspace: " +
                url.origin +
                "\n\nThis is a notification, not a payment request.",
            }),
          };
          await this.db.batch([
            insert,
            clientInsert,
            this.q(
              "INSERT INTO notifications(id,owner,invoice,recipient,status,payload,created_at) VALUES(?,?,?,?,?,?,?)",
              notice.id,
              this.business.id,
              i.id,
              notice.recipient,
              notice.status,
              notice.payload,
              now(),
            ),
          ]);
          try {
            await this.deliverNotice(notice.id);
          } catch {}
        } else await this.db.batch([insert, clientInsert]);
        return json(i, 201);
      }
      const id = path[1],
        action = path[2];
      const { row, data: i } = await this.invoice(id, action === "restore");
      if (path.length === 2 && method === "GET") return json(i);
      if (action === "attachments") return this.files(request, path, row, i);
      if (method !== "POST") fail(405, "Method not allowed.");
      const d = await body(request);
      if (action === "delete") {
        i.deleted = true;
        this.event(i, "Invoice moved to trash");
      } else if (action === "record-payment") {
        if (i.status !== "OPEN") fail(409, "Only open invoices can receive a manual payment.");
        if (!methods.filter((m) => m !== "DEMO").includes(d.paymentMethod))
          fail(400, "Choose a valid payment method.");
        const paymentDate = date(d.paymentDate),
          checkNumber = d.paymentMethod === "CHECK" ? text(d.checkNumber, 80) : null;
        Object.assign(i, {
          status: "PAID",
          paymentDate,
          paymentMethod: d.paymentMethod,
          checkNumber,
          paidAt: now(),
        });
        this.event(i, "Manual payment recorded  -  no money moved");
      } else if (action === "flag") {
        if (typeof d.flagged !== "boolean")
          fail(400, "Choose whether the invoice requires attention.");
        i.flagged = d.flagged;
        this.event(i, d.flagged ? "Flagged for special attention" : "Attention flag cleared");
      } else if (action === "restore") {
        i.deleted = false;
        this.event(i, "Invoice restored from trash");
      } else if (action === "notes") {
        i.notes = text(d.notes, 2000, false);
        this.event(i, "Invoice notes updated");
      } else if (action === "void") {
        if (i.status !== "OPEN") fail(409, "Only open invoices can be voided.");
        i.status = "VOID";
        this.event(i, "Invoice voided");
      } else if (action === "simulate") {
        if (i.status !== "OPEN") fail(409, "Invoice is no longer open.");
        if (!["success", "failed"].includes(d.outcome)) fail(400, "Choose a simulation outcome.");
        this.event(i, "DEMO: voice call simulated");
        if (d.outcome === "success") {
          i.status = "PAID";
          i.paidAt = now();
          i.paymentDate = now().slice(0, 10);
          i.paymentMethod = "DEMO";
          this.event(i, "DEMO: payment recorded  -  no money moved");
        } else this.event(i, "DEMO: payment failed  -  invoice remains open");
      // Reject real collection calls because this server cannot place them. A demo must not
      // claim that real money was collected.
      } else if (action === "call")
        fail(
          409,
          "Live calls require the separately configured Java/Twilio backend. This cloud workspace does not place calls.",
        );
      else if (action === "payment-details") {
        if (i.status !== "PAID" || !methods.includes(d.paymentMethod))
          fail(400, "Choose a payment method for a paid invoice.");
        i.paymentMethod = d.paymentMethod;
        i.checkNumber = d.paymentMethod === "CHECK" ? text(d.checkNumber, 80) : null;
        this.event(i, "Payment details updated");
      } else if (action === "edit") {
        const draft = this.draft(d.invoice);
        if (!["OPEN", "PAID", "VOID"].includes(d.status)) fail(400, "Choose a valid status.");
        const number = text(d.number, 80);
        const dup = await this.q(
          "SELECT id FROM invoices WHERE owner=? AND number=? COLLATE NOCASE AND id<>?",
          this.business.id,
          number,
          id,
        ).first();
        if (dup) fail(409, "Invoice number already exists.");
        if (
          d.status === "PAID" &&
          i.status !== "PAID" &&
          (!d.paymentDate || !methods.includes(d.paymentMethod))
        )
          fail(400, "Paid invoices need a payment date and method.");
        Object.assign(i, draft, {
          number,
          status: d.status,
          paymentDate: d.status === "PAID" && d.paymentDate ? date(d.paymentDate) : null,
          paymentMethod: d.status === "PAID" ? d.paymentMethod || null : null,
          checkNumber:
            d.status === "PAID" && d.paymentMethod === "CHECK" ? text(d.checkNumber, 80) : null,
        });
        if (i.paymentMethod && !methods.includes(i.paymentMethod))
          fail(400, "Invalid payment method.");
        this.event(i, "Invoice edited manually  -  no money moved");
      } else fail(404, "Route not found.");
      return json(await this.writeInvoice(row, i));
    }
    fail(404, "Route not found.");
  }
  // Keep each file linked to its business and invoice. The same access checks apply whether the
  // file contents are stored in the database or in separate file storage.
  async files(request, path, row, i) {
    const id = path[3],
      action = path[4],
      business = this.business.id;
    if (path.length === 3 && request.method === "GET")
      return json(
        (
          await this.q(
            "SELECT id,name,size,created_at AS createdAt FROM attachments WHERE owner=? AND invoice=? ORDER BY created_at DESC",
            business,
            i.id,
          ).all()
        ).results,
      );
    if (path.length === 3 && request.method === "POST") {
      const data = await bytes(request, 6 * 1024 * 1024),
        form = await new Request(request.url, {
          method: "POST",
          headers: { "Content-Type": request.headers.get("Content-Type") || "" },
          body: data,
        }).formData(),
        file = form.get("file");
      if (!file || typeof file === "string" || file.size < 1 || file.size > 5 * 1024 * 1024)
        fail(400, "Files must be between 1 byte and 5 MB.");
      const totals = await this.q(
        "SELECT count(*) AS n,coalesce(sum(size),0) AS total FROM attachments WHERE owner=? AND invoice=?",
        business,
        i.id,
      ).first();
      if (totals.n >= 10 || totals.total + file.size > 25 * 1024 * 1024)
        fail(400, "Attachment limit reached.");
      const aid = uuid(),
        key = encodeURIComponent(business) + "/" + i.id + "/" + aid,
        name = file.name.replace(/[\\/\x00-\x1f]/g, "_").slice(-200) || "attachment";
      // Save the file contents, then add its listing to the invoice. Check the limits again in
      // case another upload finished meanwhile; remove the saved file if adding the listing
      // fails.
      await this.bucket.put(key, file.stream(), {
        httpMetadata: { contentType: "application/octet-stream" },
      });
      try {
        const result = await this.q(
          "INSERT INTO attachments(id,owner,invoice,name,size,key,created_at) SELECT ?,?,?,?,?,?,? WHERE (SELECT count(*) FROM attachments WHERE owner=? AND invoice=?)<10 AND (SELECT coalesce(sum(size),0) FROM attachments WHERE owner=? AND invoice=?)+?<=?",
          aid,
          business,
          i.id,
          name,
          file.size,
          key,
          now(),
          business,
          i.id,
          business,
          i.id,
          file.size,
          25 * 1024 * 1024,
        ).run();
        if (!result.meta.changes) fail(409, "Attachment limit reached.");
        this.event(i, "Attachment added");
        await this.writeInvoice(row, i);
        return json({ id: aid, name, size: file.size, createdAt: now() }, 201);
      } catch (e) {
        await this.bucket.delete(key);
        throw e;
      }
    }
    const f = await this.q(
      "SELECT * FROM attachments WHERE id=? AND owner=? AND invoice=?",
      id,
      business,
      i.id,
    ).first();
    if (!f) fail(404, "Attachment not found.");
    if (action === "download" && request.method === "GET") {
      const object = await this.bucket.get(f.key);
      if (!object) fail(404, "Attachment not found.");
      return new Response(object.body, {
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Disposition": "attachment; filename*=UTF-8''" + encodeURIComponent(f.name),
          "X-Content-Type-Options": "nosniff",
          "Cache-Control": "private,no-store",
        },
      });
    }
    if (action === "remove" && request.method === "POST") {
      await this.q(
        "DELETE FROM attachments WHERE id=? AND owner=? AND invoice=?",
        id,
        business,
        i.id,
      ).run();
      await this.bucket.delete(f.key);
      this.event(i, "Attachment removed");
      await this.writeInvoice(row, i);
      return json({ removed: true });
    }
    fail(405, "Method not allowed.");
  }
}
// Show useful messages for problems such as invalid fields. For an unexpected server failure,
// return a general message instead of exposing internal details.
export async function serve(request, { db, bucket, user, env = {} }) {
  try {
    return await new AutoPayService(db, bucket, user, env).handle(request);
  } catch (e) {
    if (e instanceof ApiError) return json({ error: e.message }, e.status);
    if (String(e?.message || "").includes("UNIQUE constraint"))
      return json({ error: "This record already exists." }, 409);
    console.error("AutoPay request failed", e instanceof Error ? e.name : "error");
    return json({ error: "Unable to complete the request. Please retry." }, 500);
  }
}
