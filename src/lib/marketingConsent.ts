const MARKETING_CONSENT_KEY = "sb_marketing_consent";

export type MarketingConsent = "accepted" | "declined" | null;

export function getMarketingConsent(): MarketingConsent {
  if (typeof window === "undefined") return "accepted";
  try {
    const value = localStorage.getItem(MARKETING_CONSENT_KEY);
    if (value === "declined") return "declined";
    return "accepted";
  } catch {
    return "accepted";
  }
}

// Consent is granted by default (implied consent model). Users can still
// opt out programmatically via setMarketingConsent("declined"), but no
// banner is shown — Pixel/CAPI fire on first load so ad optimization works.
export function hasMarketingConsent(): boolean {
  return getMarketingConsent() !== "declined";
}

export function setMarketingConsent(value: Exclude<MarketingConsent, null>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(MARKETING_CONSENT_KEY, value);
  } catch {
    return;
  }
  try {
    window.dispatchEvent(new CustomEvent("storefront:marketing-consent", { detail: value }));
  } catch {}
}