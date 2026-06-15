const MARKETING_CONSENT_KEY = "sb_marketing_consent";

export type MarketingConsent = "accepted" | "declined" | null;

export function getMarketingConsent(): MarketingConsent {
  if (typeof window === "undefined") return null;
  try {
    const value = localStorage.getItem(MARKETING_CONSENT_KEY);
    return value === "accepted" || value === "declined" ? value : null;
  } catch {
    return null;
  }
}

export function hasMarketingConsent(): boolean {
  return getMarketingConsent() === "accepted";
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