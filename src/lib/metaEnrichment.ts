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

import { hasMarketingConsent } from "@/lib/marketingConsent";

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
  if (!hasMarketingConsent()) return;
  try {
    const params = new URLSearchParams(window.location.search);
    const fbclid = params.get("fbclid");
    if (!fbclid) return;
    const fbc = `fb.1.${Date.now()}.${fbclid}`;
    setCookie(FBC_COOKIE, fbc, FBC_TTL_DAYS);
  } catch {
    /* noop */
  }
}

export function ensureFbpCookie(): void {
  if (typeof document === "undefined") return;
  if (!hasMarketingConsent()) return;
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
  if (!hasMarketingConsent()) return "";
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
