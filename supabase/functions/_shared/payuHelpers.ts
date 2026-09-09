// Shared helpers for PayU integration (Merchant Hosted / Bolt + verify_payment API)
//
// Hashing rules (PayU spec):
//   Request hash  = sha512(key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||salt)
//   Reverse hash  = sha512(salt|status||||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key)
//   verify_payment hash = sha512(key|command|var1|salt)
//
// Hosts:
//   Production: https://secure.payu.in   (checkout)   |  https://info.payu.in   (verify API)
//   Sandbox   : https://test.payu.in     (checkout)   |  https://test.payu.in   (verify API)

import { fetchWithTimeout } from "./http.ts";

export type PayuEnv = "production" | "sandbox";

export function payuCheckoutHost(env: PayuEnv): string {
  return env === "sandbox" ? "https://test.payu.in" : "https://secure.payu.in";
}

export function payuApiHost(env: PayuEnv): string {
  return env === "sandbox" ? "https://test.payu.in" : "https://info.payu.in";
}

export async function sha512Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-512", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface PayuRequestHashParams {
  key: string;
  txnid: string;
  amount: string; // string per PayU rules e.g. "199.00"
  productinfo: string;
  firstname: string;
  email: string;
  udf1?: string;
  udf2?: string;
  udf3?: string;
  udf4?: string;
  udf5?: string;
  salt: string;
}

export async function computePayuRequestHash(p: PayuRequestHashParams): Promise<string> {
  const seq = [
    p.key,
    p.txnid,
    p.amount,
    p.productinfo,
    p.firstname,
    p.email,
    p.udf1 || "",
    p.udf2 || "",
    p.udf3 || "",
    p.udf4 || "",
    p.udf5 || "",
    // 5 empty fields (udf6..udf10 placeholders) between udf5 and salt per PayU spec
    "", "", "", "", "",
    p.salt,
  ].join("|");
  return sha512Hex(seq);
}

export interface PayuReverseHashParams {
  salt: string;
  status: string;
  udf1?: string;
  udf2?: string;
  udf3?: string;
  udf4?: string;
  udf5?: string;
  email: string;
  firstname: string;
  productinfo: string;
  amount: string;
  txnid: string;
  key: string;
  // For "additional charges" flow PayU prefixes the string. We accept it via opts.
  additionalCharges?: string;
}

export async function computePayuReverseHash(p: PayuReverseHashParams): Promise<string> {
  const base = [
    p.salt,
    p.status,
    // 5 empty fields (udf6..udf10) between status and udf5 per PayU spec
    "", "", "", "", "",
    p.udf5 || "",
    p.udf4 || "",
    p.udf3 || "",
    p.udf2 || "",
    p.udf1 || "",
    p.email,
    p.firstname,
    p.productinfo,
    p.amount,
    p.txnid,
    p.key,
  ].join("|");
  const seq = p.additionalCharges ? `${p.additionalCharges}|${base}` : base;
  return sha512Hex(seq);
}

// Calls the PayU verify_payment API server-to-server.
// Returns the raw transaction_details[txnid] object, or null if not found.
export async function verifyPayuTxn(opts: {
  env: PayuEnv;
  key: string;
  salt: string;
  txnid: string;
}): Promise<any | null> {
  const command = "verify_payment";
  const hash = await sha512Hex(`${opts.key}|${command}|${opts.txnid}|${opts.salt}`);
  const body = new URLSearchParams({
    key: opts.key,
    command,
    var1: opts.txnid,
    hash,
  });
  const url = `${payuApiHost(opts.env)}/merchant/postservice?form=2`;
  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    timeoutMs: 10_000,
    retryOnNetworkError: true,
  });
  if (!res.ok) {
    const t = await res.text();
    console.error("PayU verify_payment HTTP error", res.status, t);
    return null;
  }
  const data = await res.json().catch(() => null);
  if (!data) return null;
  const det = data?.transaction_details;
  if (!det || typeof det !== "object") return null;
  return det[opts.txnid] || null;
}

// Maps PayU status string → our normalized verdict.
//   success → paid
//   failure / userCancelled → failed
//   pending / inprogress → pending
//   bounced / dropped → failed
export type PayuVerdict = "PAID" | "PENDING" | "FAILED";

// ── UPI-app facing description ───────────────────────────────────────────────
// `productinfo` is what PayU forwards into the UPI intent as the transaction
// note, so it's the one string a shopper reads inside GPay/PhonePe/Paytm.
// PayU rejects most special characters (₹, #, &, |, quotes), so keep it to
// letters/digits/space/hyphen/dot and cap the length.
export function sanitizePayuText(s: string, max = 90): string {
  return String(s || "")
    .replace(/[^A-Za-z0-9 .\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max)
    .trim();
}

export function buildPayuProductInfo(opts: {
  storeName?: string | null;
  orderNumber?: string | number | null;
  amount: number;
  isPartial: boolean;
}): string {
  const store = sanitizePayuText(opts.storeName || "", 40);
  const order = sanitizePayuText(String(opts.orderNumber ?? ""), 14);
  const amt = Math.round(opts.amount) === opts.amount
    ? String(Math.round(opts.amount))
    : opts.amount.toFixed(2);
  const parts: string[] = [];
  if (store) parts.push(store);
  parts.push(opts.isPartial ? `Advance Rs ${amt}` : `Order Payment Rs ${amt}`);
  if (order) parts.push(`Order ${order}`);
  return sanitizePayuText(parts.join(" - ")) || "Order Payment";
}

// Injects a readable transaction note into a PayU-issued `upi://pay?...` link.
// Only touches `tn` and only when the URI is not signed — rewriting a signed
// intent would invalidate PayU's signature and the app would reject it.
export function withUpiNote(intentUrl: string, note: string): string {
  try {
    const qIdx = intentUrl.indexOf("?");
    if (qIdx < 0) return intentUrl;
    const params = new URLSearchParams(intentUrl.slice(qIdx + 1));
    if (params.get("sign")) return intentUrl;
    const clean = sanitizePayuText(note, 50);
    if (!clean) return intentUrl;
    params.set("tn", clean);
    return `${intentUrl.slice(0, qIdx)}?${params.toString()}`;
  } catch {
    return intentUrl;
  }
}

export function mapPayuStatus(status: unknown): PayuVerdict {
  const s = String(status || "").toLowerCase();
  if (s === "success" || s === "captured") return "PAID";
  if (s === "pending" || s === "in progress" || s === "inprogress" || s === "initiated") return "PENDING";
  return "FAILED";
}
