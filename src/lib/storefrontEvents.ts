// Storefront analytics events — fire-and-forget funnel tracking.
// Writes to public.storefront_events. Never blocks UX; all errors swallowed.
import { supabase } from "@/integrations/supabase/client";
import { getOrCreateSessionId, getVisitorId } from "@/lib/visitorSession";

export type StorefrontEventName =
  // Core funnel (already tracked)
  | "view_product"
  | "add_to_cart"
  | "begin_checkout"
  | "pay_click"
  | "purchase"
  // Phase 1 — checkout & payment drop analysis
  | "checkout_field_error"
  | "checkout_abandon"
  | "payment_failed"
  | "payment_retry"
  // Phase 2 — PDP engagement & discovery
  | "pdp_variant_select"
  | "pdp_deep_scroll"
  | "pdp_image_view"
  | "pdp_out_of_stock"
  | "search_performed"
  | "search_no_results"
  | "category_view"
  // Phase 3 — cart & retention
  | "cart_view"
  | "cart_remove"
  | "cart_qty_change"
  | "wishlist_add"
  | "whatsapp_click"
  | "call_owner_click";

interface FireEventArgs {
  storeId: string;
  eventName: StorefrontEventName;
  productId?: string;
  value?: number;
  currency?: string;
  metadata?: Record<string, any>;
}

// Module-level dedup: same event for same session+product within 30s collapses.
const recentEvents = new Map<string, number>();
const DEDUP_MS = 30_000;

export function fireStorefrontEvent(args: FireEventArgs): void {
  if (!args.storeId || !args.eventName) return;
  try {
    const sid = getOrCreateSessionId();
    const vid = getVisitorId();
    const purchaseOrderId = args.eventName === "purchase" ? String(args.metadata?.order_id || "") : "";
    const persistentPurchaseKey = purchaseOrderId
      ? `storefront_purchase_fired_${args.storeId}_${purchaseOrderId}`
      : "";
    if (persistentPurchaseKey) {
      try {
        if (
          sessionStorage.getItem(persistentPurchaseKey) === "1" ||
          localStorage.getItem(persistentPurchaseKey) === "1"
        ) return;
        sessionStorage.setItem(persistentPurchaseKey, "1");
        localStorage.setItem(persistentPurchaseKey, "1");
      } catch {}
    }

    const dedupKey = purchaseOrderId
      ? `${args.eventName}:order:${purchaseOrderId}`
      : `${args.eventName}:${args.productId || ""}:${sid}`;
    const now = Date.now();
    const last = recentEvents.get(dedupKey);
    if (last && now - last < DEDUP_MS) return;
    recentEvents.set(dedupKey, now);
    if (recentEvents.size > 200) {
      for (const [k, t] of recentEvents) {
        if (now - t > DEDUP_MS) recentEvents.delete(k);
      }
    }

    supabase
      .from("storefront_events" as any)
      .insert({
        store_id: args.storeId,
        session_id: sid,
        visitor_id: vid,
        event_name: args.eventName,
        product_id: args.productId || null,
        value: args.value ?? null,
        currency: args.currency || null,
        path: typeof window !== "undefined" ? window.location.pathname.slice(0, 500) : null,
        metadata: args.metadata || null,
      })
      .then(() => {}, () => {});
  } catch {}
}
