import { useEffect } from "react";
import { ensureGoogleAdsTag, ensureGtmContainer } from "@/lib/trackGoogleAds";

/**
 * Per-store Google Ads / GTM loader — mirrors useGA4.
 *  - features.google_ads_id (AW-…): configures the Google tag, reusing the
 *    gtag.js file GA4 already loads (no extra download).
 *  - features.gtm_container_id (GTM-…): loads Tag Manager deferred to idle.
 *  - Stores with neither set: complete no-op.
 */
export function useGoogleAds(
  adsId: string | null | undefined,
  gtmId: string | null | undefined,
) {
  useEffect(() => {
    if (adsId) ensureGoogleAdsTag(adsId);
  }, [adsId]);

  useEffect(() => {
    if (gtmId) ensureGtmContainer(gtmId);
  }, [gtmId]);
}
