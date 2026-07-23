// Shared HMAC-signed autologin token for WhatsApp deep-links.
//
// Format:  base64url(`${phone10}:${expEpochSec}`) + "." + base64url(hmacSha256)
// HMAC key: SUPABASE_SERVICE_ROLE_KEY (already in every function's env; never
// leaks to clients).
// TTL: 15 min — plenty for a WA click, short enough that a leaked link is
// harmless once expired.
//
// Payload keeps ONLY the canonical 10-digit Indian phone number. The
// consumer (wa-autologin) resolves that back to the auth user via the same
// `<digits>@phone.guest` convention used by phone-login / create-guest-account.

const enc = new TextEncoder();

function b64urlEncode(bytes: Uint8Array | string): string {
  const b = typeof bytes === "string" ? enc.encode(bytes) : bytes;
  let s = btoa(String.fromCharCode(...b));
  return s.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function b64urlDecode(s: string): Uint8Array {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmac(key: string, msg: string): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", k, enc.encode(msg));
  return new Uint8Array(sig);
}

/** Canonicalise a phone; returns 10-digit Indian mobile or null. */
export function canonicalPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = String(raw).replace(/\D/g, "");
  if (d.length === 13 && d.startsWith("091")) d = d.slice(3);
  else if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  else if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return d.length === 10 && /^[6-9]/.test(d) ? d : null;
}

/** 15-min default TTL. */
export const AL_DEFAULT_TTL_SEC = 15 * 60;

export async function mintAutoLoginToken(phone: string, key: string, ttlSec = AL_DEFAULT_TTL_SEC): Promise<string | null> {
  const p = canonicalPhone(phone);
  if (!p) return null;
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  const payload = `${p}:${exp}`;
  const sig = await hmac(key, payload);
  return `${b64urlEncode(payload)}.${b64urlEncode(sig)}`;
}

export async function verifyAutoLoginToken(token: string, key: string): Promise<string | null> {
  try {
    const [pB64, sB64] = token.split(".");
    if (!pB64 || !sB64) return null;
    const payload = new TextDecoder().decode(b64urlDecode(pB64));
    const expected = await hmac(key, payload);
    const given = b64urlDecode(sB64);
    if (expected.length !== given.length) return null;
    let ok = 0;
    for (let i = 0; i < expected.length; i++) ok |= expected[i] ^ given[i];
    if (ok !== 0) return null;
    const [phone, expStr] = payload.split(":");
    const exp = Number(expStr);
    if (!phone || !exp || Date.now() / 1000 > exp) return null;
    return canonicalPhone(phone);
  } catch {
    return null;
  }
}
