// Universal tracking types + canonical status model.
// Courier-specific code lives ONLY in ./couriers/*.ts

export type ShipmentStatus =
  | "confirmed"
  | "packed"
  | "shipped"
  | "in_transit"
  | "reached_hub"
  | "out_for_delivery"
  | "delivered"
  | "returned"
  | "cancelled"
  | "exception";

export const TERMINAL_STATUSES: ShipmentStatus[] = ["delivered", "returned", "cancelled"];

export interface NormalizedEvent {
  status: ShipmentStatus;
  rawStatus?: string | null;
  description?: string | null;
  location?: string | null;
  eventTime: string; // ISO
}

export interface NormalizedTracking {
  status: ShipmentStatus;
  currentLocation?: string | null;
  estimatedDelivery?: string | null;
  officialUrl?: string | null;
  events: NormalizedEvent[];
}

export interface TrackContext {
  storeId: string;
  awb: string;
  /** loadProvider(storeId, providerSlug) — throws when not configured */
  loadProvider: (provider: string) => Promise<any>;
}

export interface TrackingAdapter {
  slug: string;
  displayName: string;
  /** false => manual courier: no API, merchant updates status by hand */
  supportsApi: boolean;
  officialUrl(awb: string): string | null;
  track?(ctx: TrackContext): Promise<NormalizedTracking>;
}

/** Shared keyword mapper used by every text-based courier feed. */
export function mapByKeywords(text: string | null | undefined): ShipmentStatus {
  const t = (text ?? "").toLowerCase();
  if (!t) return "in_transit";
  if (/(delivered|dlv|consignee received)/.test(t)) return "delivered";
  if (/(rto|return|returned)/.test(t)) return "returned";
  if (/(cancel)/.test(t)) return "cancelled";
  if (/(undelivered|exception|failed|not home|refused|damage|lost|hold)/.test(t)) return "exception";
  if (/(out for delivery|ofd|with delivery|dispatched for delivery)/.test(t)) return "out_for_delivery";
  if (/(reached|arrived|received at|bagged|hub|facility|center|centre)/.test(t)) return "reached_hub";
  if (/(in transit|in-transit|shipment moved|departed|left)/.test(t)) return "in_transit";
  // "item booked" / "item_book" is India Post's first scan = handed to courier.
  if (/(picked|pickup done|shipped|manifest|awb assigned|booked|item_book)/.test(t)) return "shipped";
  if (/(packed|ready to ship|label)/.test(t)) return "packed";
  if (/(created|order placed|pickup scheduled|confirmed)/.test(t)) return "confirmed";
  return "in_transit";
}

export function statusRank(s: ShipmentStatus): number {
  const order: ShipmentStatus[] = [
    "confirmed", "packed", "shipped", "in_transit", "reached_hub",
    "out_for_delivery", "delivered",
  ];
  const i = order.indexOf(s);
  return i === -1 ? 99 : i;
}

export function hashEvent(e: NormalizedEvent): string {
  const raw = `${e.eventTime}|${e.status}|${e.location ?? ""}|${(e.description ?? "").slice(0, 80)}`;
  // FNV-1a — deterministic, no crypto import needed.
  let h = 0x811c9dc5;
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0") + raw.length.toString(16);
}
