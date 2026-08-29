import { TrackingAdapter } from "../types.ts";
import { hasPublicFeed, publicAdapter } from "./public.ts";

/**
 * Couriers a merchant can pick without any onboarding.
 *
 * Where the courier publishes the same JSON feed its own website uses
 * (Xpressbees, Shadowfax, Ecom Express, DTDC) we track them live with zero
 * credentials. India Post uses its portal web method, and everything else
 * falls back to the universal keyless aggregator — so Blue Dart and Amazon
 * Shipping auto-sync too. The merchant can still override the status by hand,
 * and we always deep-link to the courier's own page.
 */
function courier(slug: string, displayName: string, url: (awb: string) => string | null): TrackingAdapter {
  return publicAdapter(slug, displayName, url);
}

export const manualAdapters: TrackingAdapter[] = [
  courier("india_post", "India Post", () => "https://www.indiapost.gov.in/_layouts/15/DOP.Portal.Tracking/TrackConsignment.aspx"),
  courier("dtdc", "DTDC", (awb) => `https://www.dtdc.in/tracking/shipment-tracking?strCnno=${encodeURIComponent(awb)}`),
  courier("xpressbees", "Xpressbees", (awb) => `https://www.xpressbees.com/shipment/tracking?awbNo=${encodeURIComponent(awb)}`),
  courier("ecom_express", "Ecom Express", () => "https://ecomexpress.in/tracking/"),
  courier("amazon_shipping", "Amazon Shipping", () => "https://track.amazon.in/"),
  courier("shadowfax", "Shadowfax", (awb) => `https://tracker.shadowfax.in/#/consignment/${encodeURIComponent(awb)}`),
  courier("other", "Other courier", () => null),
];

/** Slugs that auto-sync with no merchant setup at all. */
export const CREDENTIAL_FREE_SLUGS = manualAdapters
  .filter((a) => hasPublicFeed(a.slug))
  .map((a) => a.slug);
