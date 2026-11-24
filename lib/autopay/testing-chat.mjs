/**
 * Free rule-based answers to supported invoice and client questions.
 * Reads the supplied business records without contacting an AI provider or changing data.
 */
const usd = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
const sum = (rows) => rows.reduce((n, i) => n + Math.round(i.amountUSD * 100), 0) / 100;
const lower = (value) => String(value || "").toLowerCase();
const help =
  "This free testing assistant understands common invoice and client reports, rather than general AI questions. Try “Summarize my invoices”, “Which invoices are overdue?”, “Show paid invoices”, “Rank clients by unpaid balance”, or include a client name or invoice number. No OpenAI requests are made.";
// Match the question to supported invoice and client reports. If it asks for something
// unsupported, explain the limit instead of making up an answer.
export function testingAnswer(context, messages) {
  const question = messages.at(-1).content,
    q = lower(question);
  if (/\b(bank|routing|account number|attachment|api key|password)\b/.test(q))
    return "Bank fields, secrets, notes, and attachment contents are not available to this assistant. I can summarize invoice amounts, statuses, dates, and client balances.";
  if (
    /\b(delete|remove|edit|update|create|charge|call|refund)\b|\b(send|email)\b.*\b(invoice|client|reminder)\b|\bmark\b.*\bpaid\b/.test(
      q,
    )
  )
    return "This testing assistant is read-only. Use the invoice or client screens to make changes. I can help you review current invoices and balances.";
  // First look for an invoice number, then a client name. For a follow-up such as "what about
  // their unpaid invoices?", reuse the client mentioned earlier.
  const findScope = (text) => {
    const value = lower(text);
    const invoice = context.invoices.find((i) => value.includes(lower(i.number)));
    if (invoice) return { invoice };
    const clients = context.clients.filter((c) => value.includes(lower(c.name)));
    if (clients.length) return { clients };
    const names = [...new Set(context.invoices.map((i) => i.client))].filter((name) =>
      value.includes(lower(name)),
    );
    return names.length ? { names } : null;
  };
  let scope = findScope(question);
  if (!scope && /^(and\b|what about\b|how about\b|their\b|those\b|them\b|also\b)/.test(q))
    for (const m of [...messages.slice(0, -1)].reverse())
      if (m.role === "user" && (scope = findScope(m.content))) break;
  const isClients = /\bclients?\b|\bcustomers?\b/.test(q),
    overdue = /\boverdue\b|\bpast due\b|\blate\b/.test(q),
    unpaid = /\bunpaid\b|\bopen\b|\bpending\b|\boutstanding\b/.test(q),
    paid = !unpaid && /\bpaid\b|\bcollected\b/.test(q),
    voided = /\bvoid(?:ed)?\b/.test(q),
    ranking = /\bhighest\b|\blargest\b|\btop\b|\brank\b/.test(q);
  if (
    !scope &&
    !isClients &&
    !overdue &&
    !unpaid &&
    !paid &&
    !voided &&
    !/\binvoices?\b|\bsummary\b|\bsummarize\b|\bbalances?\b|\bowe\b/.test(q)
  )
    return help;
  if (/\b(last|next|this)\s+(week|month|year)\b|\bbetween\b|\bsince\b|\bquarter\b/.test(q))
    return "Date-range questions are not supported in this testing version yet. Use the invoice date filters, or ask for overdue invoices, paid invoices, or a client summary.";
  let invoices = context.invoices,
    clients = context.clients,
    title = context.business;
  if (scope?.invoice) {
    invoices = [scope.invoice];
    clients = [];
    title = scope.invoice.number;
  } else if (scope) {
    const names = scope.clients ? scope.clients.map((c) => c.name) : scope.names;
    const ids = new Set(scope.clients?.flatMap((c) => c.invoiceIds || []) || []);
    invoices = invoices.filter((i) => names.includes(i.client) || ids.has(i.id));
    clients = clients.filter((c) => names.includes(c.name));
    title = names.join(", ");
  }
  const open = invoices.filter((i) => i.status === "OPEN"),
    settled = invoices.filter((i) => i.status === "PAID"),
    late = open.filter((i) => i.dueDate < context.asOfUTC);
  let rows = overdue
    ? late
    : unpaid
      ? open
      : paid
        ? settled
        : voided
          ? invoices.filter((i) => i.status === "VOID")
          : invoices;
  const lines = [`${title} · ${context.asOfUTC} UTC`];
  if (isClients && !scope?.invoice) {
    let shown = overdue
      ? clients.filter((c) => c.overdueUSD > 0)
      : unpaid
        ? clients.filter((c) => c.outstandingUSD > 0)
        : paid
          ? clients.filter((c) => c.paidUSD > 0)
          : clients;
    shown = [...shown].sort((a, b) =>
      ranking
        ? overdue
          ? b.overdueUSD - a.overdueUSD
          : paid
            ? b.paidUSD - a.paidUSD
            : b.outstandingUSD - a.outstandingUSD
        : a.name.localeCompare(b.name),
    );
    lines.push(`${shown.length} matching client${shown.length === 1 ? "" : "s"}.`);
    for (const c of shown.slice(0, 10))
      lines.push(
        `• ${c.name}: ${c.invoiceCount} invoices · unpaid ${usd(c.outstandingUSD)} · overdue ${usd(c.overdueUSD)} · paid ${usd(c.paidUSD)}`,
      );
    if (!shown.length) lines.push("No clients match this report.");
    if (shown.length > 10)
      lines.push(`Showing 10 of ${shown.length} clients. Ask for a specific client by full name.`);
  } else {
    lines.push(
      `${invoices.length} invoices · Outstanding ${usd(sum(open))} · Paid ${usd(sum(settled))} · Overdue ${usd(sum(late))} (${late.length})`,
    );
    const label = overdue
      ? "Overdue invoices"
      : unpaid
        ? "Unpaid invoices"
        : paid
          ? "Paid invoices"
          : voided
            ? "Void invoices"
            : "Invoices";
    lines.push(`${label}: ${rows.length}`);
    rows = [...rows].sort((a, b) =>
      ranking ? b.amountUSD - a.amountUSD : String(a.dueDate).localeCompare(String(b.dueDate)),
    );
    for (const i of rows.slice(0, 10)) {
      const status = i.status === "OPEN" && i.dueDate < context.asOfUTC ? "OVERDUE" : i.status;
      lines.push(
        `• ${i.number} · ${i.client} · ${usd(i.amountUSD)} · ${status} · due ${i.dueDate}${i.status === "PAID" && i.paymentDate ? " · paid " + i.paymentDate : ""}`,
      );
    }
    if (!rows.length) lines.push("No invoices match this report.");
    if (rows.length > 10)
      lines.push(
        `Showing 10 of ${rows.length} invoices. Ask for a specific invoice number or client name.`,
      );
    if (scope?.invoice) {
      const i = scope.invoice;
      lines.push(`Payment method: ${i.paymentMethod || "Not recorded"}`);
      for (const item of (i.items || []).slice(0, 10))
        lines.push(`• ${item.description}: ${item.quantity} × ${usd(item.unitPrice)}`);
    }
  }
  if (paid || settled.length)
    lines.push("Paid is a recorded invoice status; this report does not confirm bank settlement.");
  return lines.join("\n");
}
