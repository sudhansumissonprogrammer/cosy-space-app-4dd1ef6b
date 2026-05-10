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
  window.__SF_CAPI_USER__ = user;
}

export function getCapiUser(): CapiUser {
  if (typeof window === "undefined") return {};
  return window.__SF_CAPI_USER__ || {};
}
