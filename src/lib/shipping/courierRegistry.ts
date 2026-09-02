// Client-side courier metadata (display only). Courier API logic lives in
// supabase/functions/_shared/tracking/couriers/*. The UI never branches on
// courier — it just looks up a label here.

export type ShipmentStatus =
  | "confirmed" | "packed" | "shipped" | "in_transit" | "reached_hub"
  | "out_for_delivery" | "delivered" | "returned" | "cancelled" | "exception";

export const SHIPMENT_STATUS_LABEL: Record<ShipmentStatus, string> = {
  confirmed: "Order Confirmed",
  packed: "Packed",
  shipped: "Shipped",
  in_transit: "In Transit",
  reached_hub: "Reached Hub",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  returned: "Returned to seller (RTO)",
  cancelled: "Cancelled",
  exception: "Delivery Exception",
};

/** Progress steps shown on the timeline (terminal states render separately). */
export const SHIPMENT_STEPS: ShipmentStatus[] = [
  "confirmed", "packed", "shipped", "in_transit", "reached_hub", "out_for_delivery", "delivered",
];

export function shipmentStatusRank(s: string): number {
  const i = SHIPMENT_STEPS.indexOf(s as ShipmentStatus);
  return i === -1 ? 0 : i;
}

export function isTerminal(s: string) {
  return s === "delivered" || s === "returned" || s === "cancelled";
}

export interface CourierMeta {
  slug: string;
  name: string;
  /** Auto-syncs from the courier API / public feed when available. */
  api: boolean;
  /** Brand domain — used to resolve the courier logo. */
  domain?: string;
}

export const COURIERS: CourierMeta[] = [
  { slug: "shiprocket", name: "Shiprocket", api: true, domain: "shiprocket.in" },
  { slug: "delhivery", name: "Delhivery", api: true, domain: "delhivery.com" },
  { slug: "ekart", name: "Ekart Logistics", api: true, domain: "ekartlogistics.com" },
  { slug: "india_post", name: "India Post", api: false, domain: "indiapost.gov.in" },
  { slug: "bluedart", name: "Blue Dart", api: true, domain: "bluedart.com" },
  { slug: "dtdc", name: "DTDC", api: false, domain: "dtdc.in" },
  { slug: "xpressbees", name: "Xpressbees", api: false, domain: "xpressbees.com" },
  { slug: "ecom_express", name: "Ecom Express", api: false, domain: "ecomexpress.in" },
  { slug: "amazon_shipping", name: "Amazon Shipping", api: true, domain: "amazon.in" },
  { slug: "shadowfax", name: "Shadowfax", api: false, domain: "shadowfax.in" },
  { slug: "other", name: "Other courier", api: false },
];

export function courierMeta(slug?: string | null): CourierMeta {
  return COURIERS.find((c) => c.slug === slug) ?? { slug: slug ?? "other", name: slug ? slug.replace(/_/g, " ") : "Courier", api: false };
}

/**
 * @deprecated Logos are now bundled locally — see `courierLogoSrc` in
 * `@/lib/shipping/courierLogos`. Kept only as a remote fallback.
 */
export function courierLogo(slug?: string | null, size = 64): string | null {
  const domain = courierMeta(slug).domain;
  if (!domain) return null;
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=${size}`;
}


/** Universal fallback aggregator when the courier has no deep link. */
export function aggregatorTrackingUrl(awb: string) {
  return `https://t.17track.net/en#nums=${encodeURIComponent(awb)}`;
}

export function officialTrackingUrl(slug: string | null | undefined, awb: string | null | undefined): string | null {
  if (!awb) return null;
  const a = encodeURIComponent(awb.trim());
  switch (slug) {
    case "shiprocket": return `https://shiprocket.co/tracking/${a}`;
    case "delhivery": return `https://www.delhivery.com/track-v2/package/${a}`;
    case "ekart": return `https://ekartlogistics.com/shipmenttrack/${a}`;
    case "bluedart": return `https://www.bluedart.com/web/guest/trackdartresult?trackFor=0&trackNo=${a}`;
    case "xpressbees": return `https://www.xpressbees.com/shipment/tracking?awbNo=${a}`;
    case "shadowfax": return `https://tracker.shadowfax.in/#/consignment/${a}`;
    case "ecom_express": return `https://ecomexpress.in/tracking/?awb_field=${a}`;
    case "amazon_shipping": return `https://track.amazon.in/tracking/${a}`;
    // India Post + DTDC have no public deep link (session/JS gated portals) —
    // the aggregator resolves the same scans by AWB.
    case "india_post": return aggregatorTrackingUrl(awb);
    case "dtdc": return `https://www.dtdc.in/tracking/shipment-tracking?strCnno=${a}`;
    default: return aggregatorTrackingUrl(awb);
  }
}
