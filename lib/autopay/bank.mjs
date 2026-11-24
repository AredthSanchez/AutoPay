import { ApiError } from "./service.mjs";
const utf8 = new TextEncoder(),
  decode = new TextDecoder();
const encode = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const bytes = (value) => Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
async function key(secret) {
  if (!secret) throw new ApiError(503, "Bank storage encryption is not configured.");
  const raw = bytes(secret);
  if (raw.length !== 32) throw new ApiError(503, "Bank storage encryption key is invalid.");
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}
export async function encryptBank(data, secret, business, client) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: utf8.encode(business + ":" + client) },
    await key(secret),
    utf8.encode(JSON.stringify(data)),
  );
  return JSON.stringify({ version: 1, iv: encode(iv), cipher: encode(cipher) });
}
export async function decryptBank(payload, secret, business, client) {
  if (!payload) return null;
  const data = JSON.parse(payload);
  const clear = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: bytes(data.iv), additionalData: utf8.encode(business + ":" + client) },
    await key(secret),
    bytes(data.cipher),
  );
  return JSON.parse(decode.decode(clear));
}
export function validateBank(d) {
  const field = (value, max = 150) => {
    if (typeof value !== "string" || value.length > max)
      throw new ApiError(400, "Invalid bank details.");
    return value.trim();
  };
  const bank = {
    bankName: field(d.bankName),
    accountHolder: field(d.accountHolder),
    accountType: field(d.accountType, 20),
    routingNumber: field(d.routingNumber, 9),
    accountNumber: field(d.accountNumber, 17),
  };
  if (
    !bank.bankName ||
    !bank.accountHolder ||
    !["CHECKING", "SAVINGS"].includes(bank.accountType) ||
    !/^\d{4,17}$/.test(bank.accountNumber) ||
    !/^\d{9}$/.test(bank.routingNumber)
  )
    throw new ApiError(
      400,
      "Enter bank name, account holder, account type, a 9-digit US routing number, and a 4-17 digit account number.",
    );
  const n = [...bank.routingNumber].map(Number);
  if (
    bank.routingNumber === "000000000" ||
    (3 * (n[0] + n[3] + n[6]) + 7 * (n[1] + n[4] + n[7]) + n[2] + n[5] + n[8]) % 10 !== 0
  )
    throw new ApiError(400, "The routing number checksum is invalid.");
  return bank;
}
