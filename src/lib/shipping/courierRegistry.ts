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
  returned: "Returned",
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
  /** Auto-syncs from the courier API when the store has credentials. */
  api: boolean;
}

export const COURIERS: CourierMeta[] = [
  { slug: "shiprocket", name: "Shiprocket", api: true },
  { slug: "delhivery", name: "Delhivery", api: true },
  { slug: "ekart", name: "Ekart Logistics", api: true },
  { slug: "india_post", name: "India Post", api: false },
  { slug: "bluedart", name: "Blue Dart", api: false },
  { slug: "dtdc", name: "DTDC", api: true },
  { slug: "xpressbees", name: "Xpressbees", api: true },
  { slug: "ecom_express", name: "Ecom Express", api: true },
  { slug: "amazon_shipping", name: "Amazon Shipping", api: false },
  { slug: "shadowfax", name: "Shadowfax", api: true },
  { slug: "other", name: "Other courier", api: false },
];

export function courierMeta(slug?: string | null): CourierMeta {
  return COURIERS.find((c) => c.slug === slug) ?? { slug: slug ?? "other", name: slug ? slug.replace(/_/g, " ") : "Courier", api: false };
}

export function officialTrackingUrl(slug: string | null | undefined, awb: string | null | undefined): string | null {
  if (!awb) return null;
  const a = encodeURIComponent(awb);
  switch (slug) {
    case "shiprocket": return `https://shiprocket.co/tracking/${a}`;
    case "delhivery": return `https://www.delhivery.com/track/package/${a}`;
    case "ekart": return `https://ekartlogistics.com/track/${a}`;
    case "bluedart": return `https://www.bluedart.com/web/guest/trackdartresult?trackFor=0&trackNo=${a}`;
    case "xpressbees": return `https://www.xpressbees.com/shipment/tracking?awbNo=${a}`;
    case "shadowfax": return `https://tracker.shadowfax.in/#/consignment/${a}`;
    case "india_post": return "https://www.indiapost.gov.in/_layouts/15/DOP.Portal.Tracking/TrackConsignment.aspx";
    case "dtdc": return "https://www.dtdc.in/tracking.asp";
    case "ecom_express": return "https://ecomexpress.in/tracking/";
    default: return null;
  }
}
