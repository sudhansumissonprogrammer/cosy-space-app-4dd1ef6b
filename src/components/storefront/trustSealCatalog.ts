/**
 * Catalog of PDP trust seals.
 *
 * All images are transparent, background-removed WebP (~320px, 15–30 KB each)
 * served from the Lovable CDN. Importing the `.asset.json` pointers costs
 * nothing at runtime — they are tiny JSON objects inlined into the chunk, so
 * this file adds no network request and no PDP load-time cost. Only the seals
 * a store actually enables are ever fetched (each <img> is lazy + async).
 */
import premium from "@/assets/trust/premium-quality.webp.asset.json";
import money from "@/assets/trust/money-back-guarantee.webp.asset.json";
import shipping from "@/assets/trust/fast-free-shipping.webp.asset.json";
import secure from "@/assets/trust/secure-payments.webp.asset.json";
import support from "@/assets/trust/support-247.webp.asset.json";
import satisfaction from "@/assets/trust/satisfaction-guarantee.webp.asset.json";
import exchange from "@/assets/trust/easy-return-exchange.webp.asset.json";
import trustedSeller from "@/assets/trust/trusted-seller-badge-v3.webp.asset.json";
import shieldSecure from "@/assets/trust/secure-payment-shield.webp.asset.json";
import premiumRed from "@/assets/trust/premium-quality-red.webp.asset.json";
import trustedLabel from "@/assets/trust/trusted-label.webp.asset.json";
import officialStore from "@/assets/trust/official-store.webp.asset.json";
import bestDelivery from "@/assets/trust/best-delivery.webp.asset.json";
import bestQualityRed from "@/assets/trust/best-quality-red.webp.asset.json";

export interface TrustSeal {
  key: string;
  url: string;
  alt: string;
}

export const TRUST_SEALS: TrustSeal[] = [
  { key: "easy_return", url: exchange.url, alt: "Easy Return & Exchange" },
  { key: "premium_quality", url: premium.url, alt: "100% Premium Quality" },
  { key: "money_back", url: money.url, alt: "Money Back Guarantee" },
  { key: "fast_shipping", url: shipping.url, alt: "Fast & Free Shipping" },
  { key: "secure_payments", url: secure.url, alt: "100% Secure Payments" },
  { key: "support_247", url: support.url, alt: "24/7 Customer Support" },
  { key: "satisfaction", url: satisfaction.url, alt: "100% Satisfaction Guarantee" },
  { key: "trusted_seller", url: trustedSeller.url, alt: "Trusted Seller" },
  { key: "secure_shield", url: shieldSecure.url, alt: "Secure Payment" },
  { key: "premium_red", url: premiumRed.url, alt: "100% Premium Quality — Satisfaction Guaranteed" },
  { key: "trusted_label", url: trustedLabel.url, alt: "Trusted" },
  { key: "official_store", url: officialStore.url, alt: "Official Store" },
  { key: "best_delivery", url: bestDelivery.url, alt: "Best Delivery" },
  { key: "best_quality", url: bestQualityRed.url, alt: "Best Quality Product" },
];

export const TRUST_SEAL_MAP: Record<string, TrustSeal> = Object.fromEntries(
  TRUST_SEALS.map((s) => [s.key, s]),
);

/** Seals shown when a store has never touched the setting. */
export const DEFAULT_TRUST_SEAL_KEYS = [
  "easy_return",
  "premium_quality",
  "money_back",
  "fast_shipping",
  "secure_payments",
  "support_247",
  "satisfaction",
  "trusted_seller",
];

/** Normalise whatever is stored in theme_config.pdp_trust_seals into seals. */
export function resolveTrustSeals(raw: unknown): TrustSeal[] {
  const keys = Array.isArray(raw) && raw.length
    ? (raw as unknown[]).filter((k): k is string => typeof k === "string")
    : Array.isArray(raw)
      ? [] // explicitly empty → merchant turned all seals off
      : DEFAULT_TRUST_SEAL_KEYS;
  return keys.map((k) => TRUST_SEAL_MAP[k]).filter(Boolean);
}
