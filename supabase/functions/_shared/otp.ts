// Shared OTP helpers (merchant-otp-send / merchant-otp-verify).
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

/** Canonical 10-digit Indian mobile, or null. Mirrors src/lib/phoneUtils.ts. */
export function canonicalPhone(raw: string): string | null {
  const digits = String(raw || "").replace(/\D/g, "");
  let local = digits;
  if (local.length === 13 && local.startsWith("091")) local = local.slice(3);
  else if (local.length === 12 && local.startsWith("91")) local = local.slice(2);
  else if (local.length === 11 && local.startsWith("0")) local = local.slice(1);
  return local.length === 10 && /^[6-9]/.test(local) ? local : null;
}

/** SHA-256(phone:code:pepper) — codes are never stored in plaintext. */
export async function hashOtp(code: string, phone: string): Promise<string> {
  const data = new TextEncoder().encode(`${phone}:${code}:${SERVICE_KEY.slice(0, 32)}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time hex compare. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
