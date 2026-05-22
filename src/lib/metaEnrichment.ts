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
const FBC_TTL_DAYS = 90; // Meta's recommended lifetime
const SF_VID_COOKIE = "sf_vid";
const SF_VID_TTL_DAYS = 730; // 2y — Meta external_id should be stable
const SF_VID_LS_KEY = "__sf_vid__";

function setCookie(name: string, value: string, days: number) {
  if (typeof document === "undefined") return;
  const d = new Date();
  d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
  // Set on root domain so subdomains share it (e.g. shop.brand.com + brand.com)
  let domain = "";
  try {
    const host = window.location.hostname;
    const parts = host.split(".");
    if (parts.length >= 2 && host !== "localhost") {
      domain = `; domain=.${parts.slice(-2).join(".")}`;
    }
  } catch {}
  document.cookie = `${name}=${value}; expires=${d.toUTCString()}; path=/; SameSite=Lax${domain}`;
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
    if (!fbclid) return;
    if (getCookie(FBC_COOKIE)) return; // already set
    const fbc = `fb.1.${Date.now()}.${fbclid}`;
    setCookie(FBC_COOKIE, fbc, FBC_TTL_DAYS);
  } catch {
    /* noop */
  }
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

export function setCapiUser(user: CapiUser | null): void {
  if (typeof window === "undefined") return;
  if (!user) {
    delete window.__SF_CAPI_USER__;
    return;
  }
  // Always-on external_id: default to anon visitor cookie if caller didn't supply one.
  const externalId = user.externalId || getOrCreateSfVid() || undefined;
  const merged: CapiUser = { ...user, externalId };
  window.__SF_CAPI_USER__ = merged;

  // Mirror to Pixel Advanced Matching for the pixel-only path.
  // Meta auto-hashes plaintext em/ph/external_id/fn/ln/ct/st/zp passed to fbq("init").
  // This lifts EMQ ~1.5 points for stores that never add a CAPI access token.
  try {
    const pixelId = (window as any).__SF_PIXEL_INITED__;
    if (!pixelId || typeof (window as any).fbq !== "function") return;
    const am: Record<string, string> = {};
    if (merged.email) am.em = merged.email.trim().toLowerCase();
    if (merged.phone) am.ph = merged.phone.replace(/\D/g, "");
    if (merged.externalId) am.external_id = merged.externalId;
    if (merged.firstName) am.fn = merged.firstName.trim().toLowerCase();
    if (merged.lastName) am.ln = merged.lastName.trim().toLowerCase();
    if (merged.city) am.ct = merged.city.trim().toLowerCase().replace(/\s+/g, "");
    if (merged.state) am.st = merged.state.trim().toLowerCase().replace(/\s+/g, "");
    if (merged.zipCode) am.zp = merged.zipCode.trim().toLowerCase().replace(/\s+/g, "");
    if (Object.keys(am).length > 0) {
      (window as any).fbq("init", pixelId, am);
    }
  } catch {
    /* noop */
  }
}

export function getCapiUser(): CapiUser {
  if (typeof window === "undefined") return {};
  return window.__SF_CAPI_USER__ || {};
}
