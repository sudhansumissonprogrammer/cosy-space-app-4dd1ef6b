// Google Ads conversion tracking — mirrors the Meta Pixel pattern.
//
// Design rules:
//  - Reuses the gtag.js file GA4 already loads (zero extra script download).
//  - Production hosts only; stores without features.google_ads_id: full no-op.
//  - Purchase fires once per order (localStorage guard) with transaction_id
//    so page reloads never double-count in Google Ads.
//  - No consent banner (India/DPDP project policy) and no customer-matching
//    identifiers are sent — enhanced conversions stay off until a store has
//    a recorded advertising-consent flow.

declare global {
  interface Window {
    dataLayer?: any[];
    gtag?: (...args: any[]) => void;
    __SF_GADS_INITED__?: string;
  }
}

function isNonProductionHost(): boolean {
  if (typeof window === "undefined") return true;
  const host = window.location.hostname;
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.endsWith(".lovableproject.com") ||
    host.endsWith(".lovable.app") ||
    host.endsWith(".lovable.dev") ||
    host.endsWith(".sandbox.lovable.dev")
  );
}

function ensureGtagStub() {
  window.dataLayer = window.dataLayer || [];
  if (typeof window.gtag !== "function") {
    window.gtag = function gtag(...args: any[]) {
      window.dataLayer!.push(args);
    };
    window.gtag("js", new Date());
  }
}

/**
 * Load + configure the Google Ads tag (AW-…). Safe to call repeatedly.
 * If GA4 already loaded gtag.js we only add the AW- config — same file.
 */
export function ensureGoogleAdsTag(adsId: string | null | undefined) {
  if (!adsId) return;
  if (isNonProductionHost()) return;
  if (window.__SF_GADS_INITED__ === adsId) return;
  window.__SF_GADS_INITED__ = adsId;

  ensureGtagStub();
  // send_page_view stays untouched — GA4 config owns page_view behaviour.
  window.gtag!("config", adsId);

  const schedule =
    typeof requestIdleCallback !== "undefined"
      ? (cb: () => void) => requestIdleCallback(cb, { timeout: 4000 })
      : (cb: () => void) => setTimeout(cb, 2000);
  schedule(() => {
    // gtag.js is one shared file; only append if no gtag script exists yet.
    if (document.getElementById("ga4-script") || document.getElementById("gads-script")) return;
    const s = document.createElement("script");
    s.id = "gads-script";
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${adsId}`;
    document.head.appendChild(s);
  });
}

/**
 * Load a Google Tag Manager container, deferred to idle so it never blocks
 * the main photo. Only used when a store explicitly sets a GTM- ID.
 */
export function ensureGtmContainer(gtmId: string | null | undefined) {
  if (!gtmId) return;
  if (isNonProductionHost()) return;
  if (document.getElementById("gtm-script")) return;

  ensureGtagStub();
  const schedule =
    typeof requestIdleCallback !== "undefined"
      ? (cb: () => void) => requestIdleCallback(cb, { timeout: 5000 })
      : (cb: () => void) => setTimeout(cb, 3000);
  schedule(() => {
    if (document.getElementById("gtm-script")) return;
    window.dataLayer!.push({ "gtm.start": Date.now(), event: "gtm.js" });
    const s = document.createElement("script");
    s.id = "gtm-script";
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(gtmId)}`;
    document.head.appendChild(s);
  });
}

export interface GoogleAdsPurchaseArgs {
  adsId: string | null | undefined;
  /** Conversion label from Google Ads → Conversions → Purchase → Tag setup */
  purchaseLabel: string | null | undefined;
  orderId: string;
  value: number;
  currency: string;
}

/**
 * Fire the Google Ads Purchase conversion exactly once per order.
 * transaction_id = order ID → Google dedupes reloads server-side too.
 */
export function fireGoogleAdsPurchase(args: GoogleAdsPurchaseArgs) {
  const { adsId, purchaseLabel, orderId, value, currency } = args;
  if (!adsId || !purchaseLabel || !orderId) return;
  if (isNonProductionHost()) return;
  try {
    const dedupKey = `gads_purchase_${adsId}_${orderId}`;
    if (localStorage.getItem(dedupKey) === "1") return;
    localStorage.setItem(dedupKey, "1");

    ensureGoogleAdsTag(adsId);
    if (typeof window.gtag !== "function") return;
    window.gtag("event", "conversion", {
      send_to: `${adsId}/${purchaseLabel}`,
      value,
      currency,
      transaction_id: orderId,
    });
  } catch {
    /* never break the confirmation page */
  }
}
