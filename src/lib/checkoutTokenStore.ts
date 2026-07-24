// IABB (Instagram/Facebook in-app browser) wipes sessionStorage when the tab
// is backgrounded — e.g. when the user opens PhonePe/GPay for a UPI payment
// and returns to the store. That used to spawn a fresh checkout_token on
// remount → duplicate pending orders across every payment gateway.
//
// Cookies survive that lifecycle, so we persist the idempotency token in a
// host-scoped cookie for 30 minutes (matches the abandon-cart window).
// place-order dedupes by this token, so PayU, Cashfree, Razorpay and UPI
// intent flows all benefit automatically.

const COOKIE_NAME = "sb_ct";
const TTL_SECONDS = 1800; // 30 minutes

export function readCheckoutTokenCookie(): string | null {
  try {
    const m = document.cookie.match(/(?:^|;\s*)sb_ct=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  } catch {
    return null;
  }
}

export function writeCheckoutTokenCookie(val: string): void {
  try {
    const secure = location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${COOKIE_NAME}=${encodeURIComponent(
      val,
    )}; Max-Age=${TTL_SECONDS}; Path=/; SameSite=Lax${secure}`;
  } catch {
    /* noop */
  }
}

export function clearCheckoutTokenCookie(): void {
  try {
    document.cookie = `${COOKIE_NAME}=; Max-Age=0; Path=/; SameSite=Lax`;
  } catch {
    /* noop */
  }
}

export function mintCheckoutToken(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `ct_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

/**
 * Get or create a persistent checkout token. On IABB reloads/rehydrations the
 * cookie survives, so the same token is reused and place-order updates the
 * existing pending order in place instead of creating a duplicate.
 */
export function getOrCreateCheckoutToken(): string {
  const existing = readCheckoutTokenCookie();
  if (existing && existing.length >= 8) return existing;
  const fresh = mintCheckoutToken();
  writeCheckoutTokenCookie(fresh);
  return fresh;
}
