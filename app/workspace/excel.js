/**
 * Creates a minimal XLSX workbook in the browser using XML parts in an uncompressed ZIP.
 * User-entered strings are written as text cells, while invoice amounts remain numeric cells.
 */
import { status, paymentDay, aging } from "./domain.js";
const encoder = new TextEncoder();
const xml = (value) =>
  String(value ?? "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c],
    );
const column = (n) => {
  let s = "";
  for (n++; n; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let n = 0; n < 8; n++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
// OOXML is a ZIP of XML parts. Stored entries avoid an extra runtime dependency.
// Write ZIP local headers, CRC checksums, and a central directory for the XLSX package.
function zip(parts) {
  const entries = [],
    directory = [];
  let offset = 0;
  const header = (size) => {
    const bytes = new Uint8Array(size);
    return { bytes, view: new DataView(bytes.buffer) };
  };
  for (const [path, content] of Object.entries(parts)) {
    const name = encoder.encode(path),
      data = encoder.encode(content),
      crc = crc32(data),
      h = header(30);
    h.view.setUint32(0, 0x04034b50, true);
    h.view.setUint16(4, 20, true);
    h.view.setUint16(12, 33, true);
    h.view.setUint32(14, crc, true);
    h.view.setUint32(18, data.length, true);
    h.view.setUint32(22, data.length, true);
    h.view.setUint16(26, name.length, true);
    entries.push(h.bytes, name, data);
    const c = header(46);
    c.view.setUint32(0, 0x02014b50, true);
    c.view.setUint16(4, 20, true);
    c.view.setUint16(6, 20, true);
    c.view.setUint16(14, 33, true);
    c.view.setUint32(16, crc, true);
    c.view.setUint32(20, data.length, true);
    c.view.setUint32(24, data.length, true);
    c.view.setUint16(28, name.length, true);
    c.view.setUint32(42, offset, true);
    directory.push(c.bytes, name);
    offset += 30 + name.length + data.length;
  }
  const end = header(22);
  end.view.setUint32(0, 0x06054b50, true);
  end.view.setUint16(8, directory.length / 2, true);
  end.view.setUint16(10, directory.length / 2, true);
  end.view.setUint32(
    12,
    directory.reduce((n, b) => n + b.length, 0),
    true,
  );
  end.view.setUint32(16, offset, true);
  return new Blob([...entries, ...directory, end.bytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
// Use inline-string cells for user text so leading =, +, or - is not interpreted as a formula.
export function invoiceWorkbook(invoices, paymentLabels = {}) {
  const rows = [
    [
      "Invoice",
      "Client",
      "Email",
      "Phone",
      "Due date",
      "Payment date",
      "Aging days past due",
      "Payment method",
      "Check number",
      "Amount USD",
      "Status",
      "Needs attention",
      "Notes",
    ],
    ...invoices.map((i) => [
      i.number,
      i.client,
      i.email,
      i.phone,
      i.dueDate,
      paymentDay(i) || "",
      aging(i).days ?? "",
      paymentLabels[i.paymentMethod] || i.paymentMethod || "",
      i.checkNumber || "",
      i.total,
      status(i),
      i.flagged ? "Yes" : "No",
      i.notes || "",
    ]),
  ];
  const sheet = rows
    .map(
      (row, r) =>
        `<row r="${r + 1}">${row
          .map((value, c) => {
            const ref = column(c) + (r + 1);
            return typeof value === "number"
              ? `<c r="${ref}"${c === 9 ? ' s="1"' : ""}><v>${value}</v></c>`
              : `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
          })
          .join("")}</row>`,
    )
    .join("");
  return zip({
    "[Content_Types].xml":
      '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
    "_rels/.rels":
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    "xl/workbook.xml":
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Invoices" sheetId="1" r:id="rId1"/></sheets></workbook>',
    "xl/_rels/workbook.xml.rels":
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
    "xl/styles.xml":
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>',
    "xl/worksheets/sheet1.xml": `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="13" width="22" customWidth="1"/></cols><sheetData>${sheet}</sheetData><autoFilter ref="A1:M${rows.length}"/></worksheet>`,
  });
}
// Release the temporary object URL after the browser has started the download.
export function downloadWorkbook(blob, name) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
