export const money = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
export const cents = (n) => {
  const value = String(n);
  if (!/^\d+(\.\d{1,2})?$/.test(value))
    throw Error("Use a positive amount with up to two decimals.");
  const [whole, fraction = ""] = value.split(".");
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(result) || result <= 0 || result > 100000000)
    throw Error("Unit price must be between $0.01 and $1,000,000.");
  return result;
};
export const total = (items) => {
  if (!items.length || items.length > 50) throw Error("Add between 1 and 50 items.");
  const sum = items.reduce((sum, item) => {
    if (!item.description.trim()) throw Error("Each item needs a description.");
    if (!Number.isInteger(Number(item.quantity)) || item.quantity < 1 || item.quantity > 10000)
      throw Error("Quantity must be a whole number between 1 and 10,000.");
    return sum + cents(item.unitPrice) * Number(item.quantity);
  }, 0);
  if (sum > 1000000000) throw Error("Invoice total exceeds $10,000,000.");
  return sum / 100;
};
export const status = (i) =>
  i.status === "OPEN" && i.dueDate < localDate() ? "OVERDUE" : i.status;
export const localDate = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export function seeds() {
  return [
    {
      client: "Northstar Studio",
      email: "billing@northstar.example",
      phone: "+19155550101",
      amount: 4850,
      days: 7,
      status: "OPEN",
      item: "Brand system & website development",
    },
    {
      client: "Atlas Manufacturing",
      email: "accounts@atlas.example",
      phone: "+19155550102",
      amount: 7200,
      days: -5,
      status: "OPEN",
      item: "Workflow automation project",
    },
    {
      client: "Forma Digital",
      email: "hello@forma.example",
      phone: "+19155550103",
      amount: 2400,
      days: -12,
      status: "PAID",
      item: "Application maintenance",
    },
    {
      client: "Mesa Logistics",
      email: "finance@mesa.example",
      phone: "+19155550104",
      amount: 3650,
      days: 14,
      status: "OPEN",
      item: "Operations dashboard",
    },
    {
      client: "Orbit Labs",
      email: "team@orbit.example",
      phone: "+19155550105",
      amount: 1850,
      days: -18,
      status: "PAID",
      item: "Data integration services",
    },
  ].map((s, n) => ({
    id: crypto.randomUUID(),
    number: `INV-${String(1041 + n).padStart(4, "0")}`,
    client: s.client,
    email: s.email,
    phone: s.phone,
    total: s.amount,
    dueDate: localDate(s.days),
    status: s.status,
    paidAt: s.status === "PAID" ? new Date().toISOString() : null,
    createdAt: new Date().toISOString(),
    items: [{ description: s.item, quantity: 1, unitPrice: s.amount }],
    notes: "Thank you for your business.",
    activity: [
      `${new Date().toISOString()} | Sample invoice created`,
      ...(s.status === "PAID"
        ? [`${new Date().toISOString()} | DEMO: payment recorded  -  no money moved`]
        : []),
    ],
  }));
}
export const paymentDay = (i) => {
  if (i.paymentDate) return i.paymentDate;
  if (!i.paidAt) return null;
  const d = new Date(i.paidAt);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export function aging(i, today = localDate()) {
  if (i.status === "VOID") return { text: "Not applicable", days: null };
  const reference = i.status === "PAID" ? paymentDay(i) : today;
  if (!reference) return { text: "Not recorded", days: null };
  const delta = Math.round(
    (Date.parse(reference + "T00:00:00Z") - Date.parse(i.dueDate + "T00:00:00Z")) / 86400000,
  );
  if (i.status === "PAID")
    return { text: delta > 0 ? `Paid ${delta}d late` : "Paid on time", days: Math.max(0, delta) };
  return {
    text: delta > 0 ? `${delta} days overdue` : delta === 0 ? "Due today" : `Due in ${-delta} days`,
    days: Math.max(0, delta),
  };
}
export const emptyFilters = () => ({
  dueFrom: "",
  dueTo: "",
  paidFrom: "",
  paidTo: "",
  ageMin: "",
  ageMax: "",
  amountMin: "",
  amountMax: "",
});
export function matchesFilters(i, f) {
  const day = i.status === "PAID" ? paymentDay(i) : null,
    days = aging(i).days;
  if ((f.dueFrom && i.dueDate < f.dueFrom) || (f.dueTo && i.dueDate > f.dueTo)) return false;
  if ((f.paidFrom && (!day || day < f.paidFrom)) || (f.paidTo && (!day || day > f.paidTo)))
    return false;
  if (
    (f.ageMin !== "" && (days === null || days < Number(f.ageMin))) ||
    (f.ageMax !== "" && (days === null || days > Number(f.ageMax)))
  )
    return false;
  if (
    (f.amountMin !== "" && i.total < Number(f.amountMin)) ||
    (f.amountMax !== "" && i.total > Number(f.amountMax))
  )
    return false;
  return true;
}
export function workspaceMatches(query, invoices, clients) {
  const tokens = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return { invoices: [], clients: [] };
  const match = (text) => tokens.every((token) => text.toLowerCase().includes(token));
  return {
    invoices: invoices.filter(
      (i) =>
        !i.deleted &&
        match(
          [i.number, i.client, i.email, i.phone, i.notes, i.checkNumber].filter(Boolean).join(" "),
        ),
    ),
    clients: clients.filter((c) =>
      match([c.name, c.email, c.phone, c.notes].filter(Boolean).join(" ")),
    ),
  };
}

export function quickMatches(invoice, view, today = localDate()) {
  if (view === "attention") return !!invoice.flagged;
  if (view === "overdue") return invoice.status === "OPEN" && invoice.dueDate < today;
  if (view === "week") {
    const end = new Date(today + "T12:00:00Z");
    end.setUTCDate(end.getUTCDate() + 7);
    return (
      invoice.status === "OPEN" &&
      invoice.dueDate >= today &&
      invoice.dueDate <= end.toISOString().slice(0, 10)
    );
  }
  return true;
}
export function sortInvoices(invoices, sort = "newest") {
  const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });
  return [...invoices].sort((a, b) => {
    let result = 0;
    if (sort === "due") result = collator.compare(a.dueDate || "9999", b.dueDate || "9999");
    else if (sort === "amountHigh") result = b.total - a.total;
    else if (sort === "amountLow") result = a.total - b.total;
    else if (sort === "client") result = collator.compare(a.client, b.client);
    else if (sort === "number") result = collator.compare(a.number, b.number);
    else result = collator.compare(b.createdAt || "", a.createdAt || "");
    return result || collator.compare(a.number, b.number) || collator.compare(a.id, b.id);
  });
}
export function duplicateDraft(invoice) {
  return {
    client: invoice.client,
    email: invoice.email,
    phone: invoice.phone || "",
    notes: invoice.notes || "",
    dueDate: localDate(14),
    items: invoice.items.map((item) => ({ ...item })),
  };
}
