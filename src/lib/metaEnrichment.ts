/**
 * Meta Pixel + CAPI enrichment helpers.
 *
 * Two responsibilities:
 *  1. Persist `_fbc` cookie when the visitor lands with `?fbclid=` so subsequent
 *     pageviews + CAPI events still carry the click ID. Without this, attribution
 *     dies the moment the shopper navigates to a second page.
 *  2. Maintain a global user-data registry that fireMetaCAPI() merges into every
 *     event automatically (email/phone/external_id of the logged-in storefront
 *     customer). Lifts Event Match Quality from ~4/10 → ~8/10, which is the
 *     single biggest lever for ad ROAS — especially on iOS where pixel cookies
 *     are blocked and CAPI is the only signal Meta gets.
 */

const FBC_COOKIE = "_fbc";
const FBP_COOKIE = "_fbp";
const FBC_TTL_DAYS = 90; // Meta's recommended lifetime
const FBP_TTL_DAYS = 90;
const SF_VID_COOKIE = "sf_vid";
const SF_VID_TTL_DAYS = 730; // 2y — Meta external_id should be stable
const SF_VID_LS_KEY = "__sf_vid__";

function setCookie(name: string, value: string, days: number) {
  if (typeof document === "undefined") return;
  const d = new Date();
  d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
  // v8.61.0 BAN-FIX P0-4: Scope cookies to the EXACT hostname, never to the
  // apex .shopbanao.in. Previously a visitor on store-a.shopbanao.in wrote
  // _fbp to the apex; that same _fbp was then read by store-b.shopbanao.in
  // and flowed into a DIFFERENT pixel ID's CAPI events. Meta's coordinated
  // inauthentic behavior detector saw the same _fbp value attached to many
  // pixel IDs across many stores → flagged the whole network → banned both
  // FB + IG ad accounts at the business level. Now each store gets its own
  // cookie scope. For merchant custom domains (brand.com) we still allow
  // shop.brand.com + brand.com to share, since those are the same business.
  let domain = "";
  try {
    const host = window.location.hostname;
    const isPlatformSubdomain =
      host.endsWith(".shopbanao.in") ||
      host.endsWith(".lovable.app") ||
      host.endsWith(".lovableproject.com");
    if (!isPlatformSubdomain && host !== "localhost") {
      const parts = host.split(".");
      if (parts.length >= 2) {
        domain = `; domain=.${parts.slice(-2).join(".")}`;
      }
    }
    // Platform subdomains: no domain attribute → cookie is host-only,
    // perfectly isolated per store.
  } catch {}
  // Add Secure on HTTPS — Meta + browser best practice. Prevents _fbp/_fbc
  // (and sf_vid) from leaking over plaintext and silences security audits.
  const secure =
    typeof window !== "undefined" && window.location?.protocol === "https:"
      ? "; Secure"
      : "";
  document.cookie = `${name}=${value}; expires=${d.toUTCString()}; path=/; SameSite=Lax${secure}${domain}`;
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${name}=`));
  return match ? match.substring(name.length + 1) : null;
}

/**
 * Persist `?fbclid=...` from the URL into the `_fbc` cookie.
 * Safe to call on every page mount — only writes once per visit.
 */
export function ensureFbcPersisted(): void {
  if (typeof window === "undefined") return;
  try {
    const params = new URLSearchParams(window.location.search);
    const fbclid = params.get("fbclid");
    const existing = getCookie(FBC_COOKIE);
    if (fbclid) {
      // Latest click wins per Meta spec — refresh cookie even if one exists,
      // and keep a sessionStorage backup so iOS ITP / FB in-app WebView
      // cookie loss doesn't tank fbc coverage on subsequent pageviews.
      const fbc = `fb.1.${Date.now()}.${fbclid}`;
      setCookie(FBC_COOKIE, fbc, FBC_TTL_DAYS);
      try { sessionStorage.setItem("__sf_fbc__", fbc); } catch {}
      return;
    }
    if (existing) {
      try { sessionStorage.setItem("__sf_fbc__", existing); } catch {}
    }
  } catch {
    /* noop */
  }
}

/**
 * Read _fbc with sessionStorage fallback. Used by fireMetaCAPI / getMetaCookies
 * so ITP cookie evictions don't drop fbc mid-session.
 */
export function readFbcWithFallback(): string {
  const fromCookie = getCookie(FBC_COOKIE);
  if (fromCookie) return fromCookie;
  try {
    const ss = sessionStorage.getItem("__sf_fbc__");
    if (ss) return ss;
  } catch {}
  return "";
}

export function ensureFbpCookie(): void {
  if (typeof document === "undefined") return;
  if (getCookie(FBP_COOKIE)) return;
  const creationTime = Date.now();
  const randomNumber = Math.floor(Math.random() * 10_000_000_000);
  setCookie(FBP_COOKIE, `fb.1.${creationTime}.${randomNumber}`, FBP_TTL_DAYS);
}

/**
 * Get or create an always-on first-party visitor ID for Pixel + CAPI
 * `external_id`. Persists in cookie (cross-tab) AND localStorage (cookie
 * cleared fallback). Anonymous visitors get a stable ID → EMQ +1.5 pts.
 *
 * Safe on SSR (returns empty string) and on cookie-blocked browsers
 * (falls back to localStorage; still stable across reloads).
 */
export function getOrCreateSfVid(): string {
  if (typeof window === "undefined") return "";
  try {
    const fromCookie = getCookie(SF_VID_COOKIE);
    if (fromCookie) {
      try { localStorage.setItem(SF_VID_LS_KEY, fromCookie); } catch {}
      return fromCookie;
    }
    let id = "";
    try { id = localStorage.getItem(SF_VID_LS_KEY) || ""; } catch {}
    if (!id) {
      id = (typeof crypto !== "undefined" && (crypto as any).randomUUID)
        ? (crypto as any).randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
    }
    setCookie(SF_VID_COOKIE, id, SF_VID_TTL_DAYS);
    try { localStorage.setItem(SF_VID_LS_KEY, id); } catch {}
    return id;
  } catch {
    return "";
  }
}

/**
 * Global user-data registry. fireMetaCAPI() reads this on every call.
 * StorefrontShell sets it when the storefront customer logs in / out.
 */
interface CapiUser {
  email?: string;
  phone?: string;
  externalId?: string;
  firstName?: string;
  lastName?: string;
  city?: string;
  state?: string;
  zipCode?: string;
}

declare global {
  interface Window {
    __SF_CAPI_USER__?: CapiUser;
  }
}

/**
 * Synthetic auth emails (`<digits>@phone.guest`) are an internal convention —
 * they never exist in Meta's user graph, so sending them as `em` guarantees a
 * miss and actively *lowers* Event Match Quality vs. sending no email at all.
 */
export function isRealEmail(value?: string): boolean {
  const e = (value || "").trim().toLowerCase();
  if (!e || !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(e)) return false;
  if (e.endsWith("@phone.guest") || e.endsWith(".guest") || e.endsWith("@n")) return false;
  return true;
}

export function setCapiUser(user: CapiUser | null): void {
  if (typeof window === "undefined") return;
  if (!user) {
    delete window.__SF_CAPI_USER__;
    return;
  }
  // MERGE, do not replace. Callers like CheckoutPhoneStep pass only { phone }
  // to seed Advanced Matching mid-checkout — a full replace would wipe the
  // signed-in shopper's email / name / customer-id (externalId) that
  // StorefrontAuthContext had already registered, tanking EMQ for the exact
  // events (InitiateCheckout / AddPaymentInfo) we're trying to lift.
  const prev = window.__SF_CAPI_USER__ || {};
  const combined: CapiUser = { ...prev, ...user };
  if (!isRealEmail(combined.email)) delete combined.email;
  // external_id MUST be stable for one human across the whole session and all
  // future sessions — Meta uses it as an identity key. Previously it flipped
  // between the anon visitor UUID, the auth user id and the per-store customer
  // id within a single checkout, so Meta saw 3 different "people" and audience
  // / lookalike building degraded. Pin it to the persistent first-party
  // visitor ID (cookie + localStorage) and never let it churn.
  const externalId = getOrCreateSfVid() || prev.externalId || user.externalId || undefined;
  const merged: CapiUser = { ...combined, externalId };
  window.__SF_CAPI_USER__ = merged;

  // Mirror to Pixel Advanced Matching for the pixel-only path.
  // Meta auto-hashes plaintext em/ph/external_id/fn/ln/ct/st/zp passed to fbq("init").
  // This lifts EMQ ~1.5 points for stores that never add a CAPI access token.
  try {
    const pixelId = (window as any).__SF_PIXEL_INITED__;
    if (!pixelId || typeof (window as any).fbq !== "function") return;
    const am: Record<string, string> = {};
    if (merged.email) am.em = merged.email.trim().toLowerCase();
    if (merged.phone) {
      // Meta matches on E.164-without-plus. A bare 10-digit Indian mobile
      // hashes to a value Meta can never match (and it mismatched the server
      // CAPI hash, which already prepends 91) → the whole browser event was
      // counted as "unmatched". Normalize here so browser + server agree.
      const digits = merged.phone.replace(/\D/g, "");
      am.ph = digits.length === 10 ? `91${digits}` : digits;
    }
    if (merged.externalId) am.external_id = merged.externalId;
    if (merged.firstName) am.fn = merged.firstName.trim().toLowerCase();
    if (merged.lastName) am.ln = merged.lastName.trim().toLowerCase();
    if (merged.city) am.ct = merged.city.trim().toLowerCase().replace(/\s+/g, "");
    if (merged.state) am.st = merged.state.trim().toLowerCase().replace(/\s+/g, "");
    if (merged.zipCode) am.zp = merged.zipCode.trim().toLowerCase().replace(/\s+/g, "");
    // Country is a free match key Meta expects alongside ct/st/zp. Server CAPI
    // already sends it; the browser side was omitting it.
    if (am.ct || am.st || am.zp || am.ph) am.country = "in";

    if (Object.keys(am).length === 0) return;
    // Dedup re-init: bootstrap already called fbq('init', pid, {external_id}).
    // If the new AM payload matches what we last sent (or is just the same
    // external_id), skip — re-init triggers Meta's "Duplicate Pixel ID" warn
    // and adds no signal. Only re-init when AM materially changes (user typed
    // email/phone in checkout, or logged in with new fields).
    const fp = JSON.stringify(am);
    const lastFp = (window as any).__SF_AM_FP__;
    const bootstrapOnlyExternalId =
      Object.keys(am).length === 1 && am.external_id;
    if (lastFp === fp) return;
    if (!lastFp && bootstrapOnlyExternalId) {
      // Bootstrap already passed external_id; record + skip.
      (window as any).__SF_AM_FP__ = fp;
      return;
    }
    (window as any).__SF_AM_FP__ = fp;
    (window as any).fbq("init", pixelId, am);
  } catch {
    /* noop */
  }
}

export function getCapiUser(): CapiUser {
  if (typeof window === "undefined") return {};
  return window.__SF_CAPI_USER__ || {};
}

/**
 * STORE ISOLATION (P0): the shopper-PII localStorage keys `checkout_phone`
 * and `checkout_address` are NOT store-scoped, and the apex origin
 * `shopbanao.in` serves every path-based storefront (`/store/:slug`) out of
 * ONE localStorage jar. Without this purge, a phone/address typed on Store A
 * would be replayed as Advanced Matching into Store B's pixel and CAPI —
 * a real cross-tenant PII leak (Shopify-grade isolation forbids this).
 *
 * Rule: PII in localStorage belongs to exactly one store. The moment a
 * different store boots on the same origin, wipe it.
 */
export const PII_OWNER_KEY = "sb_pii_store";

export function purgeForeignStorePii(storeId?: string | null): void {
  if (typeof window === "undefined" || !storeId) return;
  try {
    const owner = localStorage.getItem(PII_OWNER_KEY);
    if (owner === storeId) return;
    if (owner) {
      // Different merchant on the same origin — drop the previous shopper PII.
      ["checkout_phone", "checkout_address", "checkout_email"].forEach((k) => {
        try { localStorage.removeItem(k); } catch { /* noop */ }
      });
      try { (window as any).__SF_CAPI_USER__ = {}; } catch { /* noop */ }
    }
    localStorage.setItem(PII_OWNER_KEY, storeId);
  } catch {
    /* noop */
  }
}

/**
 * Seed Advanced Matching from what this storefront actually collects.
 *
 * We never ask for an email — the only PII we hold is the mobile number
 * (captured in the Buy Now modal / phone step) and the delivery address
 * (name, city, state, pincode) typed at checkout. Both are persisted in
 * localStorage, but until now nothing replayed them into the Pixel/CAPI
 * registry on a fresh page load, so PageView / ViewContent / AddToCart for
 * a *returning* shopper went out with no match keys at all.
 *
 * Call on storefront mount (and right after phone capture). Idempotent.
 */
export function seedCapiUserFromStorage(storeId?: string): void {
  if (typeof window === "undefined") return;
  // Never replay another store's shopper into this store's pixel.
  purgeForeignStorePii(storeId);
  try {
    const user: CapiUser = {};



    const phone = localStorage.getItem("checkout_phone") || "";
    const digits = phone.replace(/\D/g, "");
    if (digits.length >= 10) user.phone = digits;

    let addr: any = null;
    if (storeId) {
      try { addr = JSON.parse(localStorage.getItem(`express_checkout_${storeId}`) || "null"); } catch {}
    }
    if (!addr) {
      try { addr = JSON.parse(localStorage.getItem("checkout_address") || "null"); } catch {}
    }
    if (addr && typeof addr === "object") {
      const name = String(addr.fullName || addr.name || "").trim();
      if (name) {
        const parts = name.split(/\s+/).filter(Boolean);
        user.firstName = parts[0];
        if (parts.length > 1) user.lastName = parts.slice(1).join(" ");
      }
      const city = String(addr.city || "").trim();
      const state = String(addr.state || addr.stateVal || "").trim();
      const zip = String(addr.pincode || addr.zip || "").trim();
      if (city) user.city = city;
      if (state) user.state = state;
      if (zip) user.zipCode = zip;
      if (!user.phone) {
        const ad = String(addr.phone || "").replace(/\D/g, "");
        if (ad.length >= 10) user.phone = ad;
      }
    }

    if (Object.keys(user).length === 0) return;
    setCapiUser(user);
  } catch {
    /* noop */
  }
}
