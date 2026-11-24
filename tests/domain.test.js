/**
 * Unit coverage for invoice arithmetic, aging, inclusive filters, search, sorting, and duplication defaults.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  total,
  cents,
  aging,
  matchesFilters,
  emptyFilters,
  workspaceMatches,
} from "../app/workspace/domain.js";
test("money uses cents rather than floating point addition", () => {
  assert.equal(
    total([
      { description: "A", quantity: 3, unitPrice: "19.99" },
      { description: "B", quantity: 1, unitPrice: "0.01" },
    ]),
    59.98,
  );
});
test("invalid prices and quantities are rejected", () => {
  for (const price of ["-1", "1.001", "NaN", "0", "1000001"]) assert.throws(() => cents(price));
  assert.throws(() => total([{ description: "A", quantity: 1.5, unitPrice: "1" }]));
  assert.throws(() => total([{ description: "", quantity: 1, unitPrice: "1" }]));
});

test("aging uses due date and does not age void invoices", () => {
  assert.equal(aging({ status: "OPEN", dueDate: "2026-10-10" }, "2026-10-15").days, 5);
  assert.equal(
    aging({ status: "OPEN", dueDate: "2026-10-20" }, "2026-10-15").text,
    "Due in 5 days",
  );
  assert.equal(aging({ status: "PAID", dueDate: "2026-10-10" }).text, "Not recorded");
  assert.equal(aging({ status: "VOID", dueDate: "2026-10-10" }).days, null);
});

test("paid aging stays anchored to the recorded payment date", () => {
  assert.equal(
    aging({ status: "PAID", dueDate: "2026-10-01", paymentDate: "2026-10-03" }, "2026-11-20").text,
    "Paid 2d late",
  );
});

test("date and amount filters combine inclusively", () => {
  const invoice = { status: "PAID", dueDate: "2026-10-01", paymentDate: "2026-10-03", total: 500 };
  const f = {
    ...emptyFilters(),
    dueFrom: "2026-10-01",
    dueTo: "2026-10-01",
    paidFrom: "2026-10-03",
    paidTo: "2026-10-03",
    ageMin: "2",
    ageMax: "2",
    amountMin: "500",
    amountMax: "500",
  };
  assert.equal(matchesFilters(invoice, f), true);
  assert.equal(matchesFilters(invoice, { ...f, amountMin: "501" }), false);
  assert.equal(matchesFilters({ ...invoice, paymentDate: null }, f), false);
});

test("workspace search finds client and invoice fields without deleted records", () => {
  const invoices = [
    { number: "INV-123", client: "Mesa Co", email: "billing@example.com", notes: "PO alpha" },
    { number: "INV-456", client: "Deleted Co", deleted: true },
  ];
  const clients = [{ name: "Mesa Co", email: "billing@example.com", phone: "+19155550199" }];
  assert.equal(workspaceMatches("INV-123", invoices, clients).invoices.length, 1);
  assert.equal(workspaceMatches("mesa billing", invoices, clients).clients.length, 1);
  assert.equal(workspaceMatches("alpha", invoices, clients).invoices.length, 1);
  assert.equal(workspaceMatches("deleted", invoices, clients).invoices.length, 0);
  assert.equal(workspaceMatches("", invoices, clients).clients.length, 0);
});

import { quickMatches, sortInvoices, duplicateDraft } from "../app/workspace/domain.js";
test("quick views include only unpaid upcoming dates and respect overdue boundaries", () => {
  const i = { status: "OPEN", dueDate: "2026-11-20", flagged: true };
  assert.equal(quickMatches(i, "week", "2026-11-20"), true);
  assert.equal(quickMatches({ ...i, dueDate: "2026-11-27" }, "week", "2026-11-20"), true);
  assert.equal(quickMatches({ ...i, dueDate: "2026-11-28" }, "week", "2026-11-20"), false);
  assert.equal(quickMatches({ ...i, status: "PAID" }, "week", "2026-11-20"), false);
  assert.equal(quickMatches(i, "overdue", "2026-11-20"), false);
  assert.equal(quickMatches({ ...i, dueDate: "2026-11-19" }, "overdue", "2026-11-20"), true);
  assert.equal(quickMatches(i, "attention"), true);
});
test("sorting is numeric, deterministic, and preserves the original invoice list", () => {
  const a = {
      id: "a",
      number: "INV-2",
      client: "Zulu",
      total: 20,
      dueDate: "2026-12-01",
      createdAt: "2026-11-02",
    },
    b = {
      id: "b",
      number: "INV-10",
      client: "Alpha",
      total: 100,
      dueDate: "2026-11-25",
      createdAt: "2026-11-01",
    },
    items = [a, b];
  assert.deepEqual(sortInvoices(items, "amountHigh"), [b, a]);
  assert.deepEqual(sortInvoices(items, "client"), [b, a]);
  assert.deepEqual(sortInvoices(items, "due"), [b, a]);
  assert.deepEqual(sortInvoices(items, "number"), [a, b]);
  assert.deepEqual(sortInvoices(items, "newest"), [a, b]);
  assert.deepEqual(items, [a, b]);
});
test("duplicate drafts reset identity and payment history while retaining editable client and line items", () => {
  const source = {
    id: "old",
    number: "INV-1",
    client: "Client",
    email: "a@example.com",
    status: "PAID",
    flagged: true,
    paymentDate: "2026-11-01",
    checkNumber: "100",
    notes: "Invoice notes",
    items: [{ description: "Work", quantity: 1, unitPrice: 20 }],
    activity: ["Private history"],
  };
  const draft = duplicateDraft(source);
  assert.equal(draft.client, source.client);
  assert.equal(draft.notes, source.notes);
  for (const key of ["id", "number", "status", "flagged", "paymentDate", "checkNumber", "activity"])
    assert.equal(draft[key], undefined);
  draft.items[0].description = "Changed";
  assert.equal(source.items[0].description, "Work");
  assert.match(draft.dueDate, /^\d{4}-\d{2}-\d{2}$/);
});
