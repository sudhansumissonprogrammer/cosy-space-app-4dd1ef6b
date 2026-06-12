/**
 * Build a descriptive, AI-search-friendly H1 for storefront pages.
 *
 * Rule (from AI search / SEO audits): the H1 must describe what the page is
 * about, NOT just the brand name. "Serdiya Jewellers" alone fails the rule;
 * "Serdiya Jewellers — Shop Gold Chains, Necklaces & Earrings Online" passes.
 *
 * Used by all 20 storefront home themes (V1–V22). Applied via `<h1 class="sr-only">`
 * so it doesn't affect any visual design — purely a crawler-readable signal.
 *
 * Order of preference for the descriptive tail:
 *   1. store.seo_h1_suffix   (merchant-provided override)
 *   2. store.tagline         (merchant tagline, if filled)
 *   3. truncated description (first sentence / 80 chars)
 *   4. generic India-friendly fallback (COD + UPI + delivery)
 */
export function buildStorefrontH1(store: any): string {
  const name = (store?.name || "Online Store").trim();

  const pick = (v: any) => (typeof v === "string" && v.trim().length > 0 ? v.trim() : "");
  const truncate = (s: string, n = 90) => (s.length > n ? s.slice(0, n - 1).replace(/[\s,;:.!?-]+$/, "") + "…" : s);

  const explicit = pick(store?.seo_h1_suffix) || pick(store?.tagline);
  if (explicit) return `${name} — ${truncate(explicit)}`;

  const desc = pick(store?.description) || pick(store?.meta_description) || pick(store?.seo_about_paragraph);
  if (desc) {
    // First sentence, truncated
    const firstSentence = desc.split(/(?<=[.!?])\s/)[0] || desc;
    return `${name} — ${truncate(firstSentence)}`;
  }

  return `${name} — Shop Online with COD, UPI Payments & Fast Delivery Across India`;
}
