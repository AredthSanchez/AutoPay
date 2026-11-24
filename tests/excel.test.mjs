/**
 * Inspects generated ZIP/XML content to verify numeric amounts, text references, and formula-safe exports.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { invoiceWorkbook } from "../app/workspace/excel.js";
// Read stored ZIP entries independently to verify the emitted workbook structure.
function entries(bytes) {
  const view = new DataView(bytes.buffer),
    out = {};
  let offset = 0;
  while (view.getUint32(offset, true) === 0x04034b50) {
    const size = view.getUint32(offset + 18, true),
      nameSize = view.getUint16(offset + 26, true),
      extra = view.getUint16(offset + 28, true);
    const name = new TextDecoder().decode(bytes.slice(offset + 30, offset + 30 + nameSize)),
      start = offset + 30 + nameSize + extra;
    out[name] = new TextDecoder().decode(bytes.slice(start, start + size));
    offset = start + size;
  }
  assert.equal(view.getUint32(offset, true), 0x02014b50);
  return out;
}
test("Excel export preserves numeric amounts, string references and hostile formula text safely", async () => {
  const blob = invoiceWorkbook(
    [
      {
        number: "INV-1",
        client: '=HYPERLINK("bad") & <client>',
        email: "a@example.com",
        phone: "+123",
        dueDate: "2026-11-01",
        paymentDate: "2026-11-03",
        status: "PAID",
        total: 123.45,
        paymentMethod: "CHECK",
        checkNumber: "000123",
        flagged: true,
        notes: "Notes\nwith newline",
      },
    ],
    { CHECK: "Check" },
  );
  assert.equal(blob.type, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  const files = entries(new Uint8Array(await blob.arrayBuffer()));
  assert.equal(Object.keys(files).length, 6);
  const sheet = files["xl/worksheets/sheet1.xml"];
  assert.match(sheet, /<c r="J2" s="1"><v>123.45<\/v><\/c>/);
  assert.match(sheet, /<c r="I2" t="inlineStr">.*000123/);
  assert.match(sheet, /=HYPERLINK\(&quot;bad&quot;\) &amp; &lt;client&gt;/);
  assert.equal(sheet.includes("<f>"), false);
  assert.match(sheet, /Needs attention/);
  assert.match(sheet, />Yes</);
  assert.match(sheet, /autoFilter ref="A1:M2"/);
});
test("empty Excel export remains a valid header-only worksheet", async () => {
  const files = entries(new Uint8Array(await invoiceWorkbook([]).arrayBuffer()));
  assert.match(files["xl/worksheets/sheet1.xml"], /autoFilter ref="A1:M1"/);
});
