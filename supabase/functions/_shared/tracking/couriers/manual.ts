import { TrackingAdapter } from "../types.ts";

/**
 * Manual couriers: no self-serve SME API in India (India Post, Blue Dart
 * direct, DTDC direct, or anything else the merchant uses).
 * The merchant updates the status; we still render the same timeline and
 * offer a deep link to the courier's own tracking page.
 */
function manual(slug: string, displayName: string, url: (awb: string) => string | null): TrackingAdapter {
  return { slug, displayName, supportsApi: false, officialUrl: url };
}

export const manualAdapters: TrackingAdapter[] = [
  manual("india_post", "India Post", () => "https://www.indiapost.gov.in/_layouts/15/DOP.Portal.Tracking/TrackConsignment.aspx"),
  manual("bluedart", "Blue Dart", (awb) => `https://www.bluedart.com/web/guest/trackdartresult?trackFor=0&trackNo=${encodeURIComponent(awb)}`),
  manual("dtdc", "DTDC", () => "https://www.dtdc.in/tracking.asp"),
  manual("xpressbees", "Xpressbees", (awb) => `https://www.xpressbees.com/shipment/tracking?awbNo=${encodeURIComponent(awb)}`),
  manual("ecom_express", "Ecom Express", () => "https://ecomexpress.in/tracking/"),
  manual("amazon_shipping", "Amazon Shipping", () => "https://track.amazon.in/"),
  manual("shadowfax", "Shadowfax", (awb) => `https://tracker.shadowfax.in/#/consignment/${encodeURIComponent(awb)}`),
  manual("other", "Other courier", () => null),
];
