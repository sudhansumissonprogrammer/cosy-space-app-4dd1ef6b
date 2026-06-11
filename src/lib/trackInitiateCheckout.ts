/**
 * Shared InitiateCheckout tracker.
 *
 * Fires three things with a single shared event_id so the Meta browser
 * (Pixel) event and the Conversions API (server) event deduplicate:
 *   1. Meta Pixel  → fbq("track", "InitiateCheckout", ..., { eventID })
 *   2. Meta CAPI   → POST to edge fn meta-capi (same eventId)
 *   3. GA4         → gtag("event", "begin_checkout", ...)
 *
 * Call this from every checkout-entry point (PDP Buy Now, cart Proceed,
 * Express Checkout, etc.) so the funnel signal is consistent and ad
 * optimization has clean mid-funnel data.
 *
 * Safe to call from any storefront page: each underlying tracker already
 * guards against preview/dev hosts and unconfigured stores.
 */
import { fbPixelTrack, generateEventId } from "@/hooks/useFacebookPixel";
import { fireMetaCAPI } from "@/lib/metaCapi";
import { ga4Track } from "@/hooks/useGA4";

export interface InitiateCheckoutItem {
  productId: string;
  variantId?: string;
  name?: string;
  price: number;
  quantity: number;
}

export interface TrackInitiateCheckoutParams {
  storeId: string;
  /** Total order value at checkout entry */
  value: number;
  /** Currency code (e.g. "INR") */
  currency: string;
  /** Items in the cart at checkout entry */
  items: InitiateCheckoutItem[];
  /** Optional explicit event id (for deduping with a pixel call you fired manually) */
  eventId?: string;
}

export function trackInitiateCheckout(params: TrackInitiateCheckoutParams) {
  const {
    storeId,
    value,
    currency,
    items,
    eventId,
  } = params;

  if (!items?.length) return;

  const eid = eventId || generateEventId();
  const contentIds = items.map((i) => i.productId);
  const numItems = items.reduce((sum, i) => sum + (i.quantity || 0), 0);

  // Meta Pixel payload (Meta spec)
  const pixelPayload = {
    content_ids: contentIds,
    content_type: "product",
    contents: items.map((i) => ({
      id: i.productId,
      quantity: i.quantity,
      item_price: i.price,
    })),
    value,
    currency,
    num_items: numItems,
  };

  try {
    fbPixelTrack("InitiateCheckout", pixelPayload, eid);
  } catch {
    /* never break the click path */
  }

  // CAPI mirror — same eventId for browser↔server dedup
  try {
    fireMetaCAPI({
      storeId,
      eventName: "InitiateCheckout",
      eventId: eid,
      value,
      currency,
      contentIds,
      contentType: "product",
      numItems,
      contents: pixelPayload.contents,
    } as any);
  } catch {
    /* swallow */
  }

  // GA4 begin_checkout
  try {
    ga4Track("begin_checkout", {
      currency,
      value,
      items: items.map((i) => ({
        item_id: i.productId,
        item_name: i.name,
        item_variant: i.variantId,
        price: i.price,
        quantity: i.quantity,
      })),
    });
  } catch {
    /* swallow */
  }

  return eid;
}
