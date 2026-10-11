// Storefront analytics events — fire-and-forget funnel tracking.
// Writes to public.storefront_events. Never blocks UX; all errors swallowed.
import { supabase } from "@/integrations/supabase/client";
import { getOrCreateSessionId, getVisitorId, isLikelyBot } from "@/lib/visitorSession";


// Direct PostgREST endpoint — used for nav-racing events (pay_click, purchase,
// begin_checkout) via keepalive fetch so the browser doesn't abort them on
// payment-gateway redirects. Matches the constants in usePageviewBeacon.
const SUPA_URL = "https://dqepeywgftbpxeeqfuwt.supabase.co";
const SUPA_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxZXBleXdnZnRicHhlZXFmdXd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMjgxMzksImV4cCI6MjA5MDkwNDEzOX0.OtLtoGBJZuEthQyePzNgAltWJwSUEpWl1z_Bx_FY6Mk";


export type StorefrontEventName =
  // Core funnel (already tracked)
  | "view_product"
  | "buy_now_click"
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
  | "call_owner_click"
  // Reel video bubble engagement
  | "reel_bubble_view"
  | "reel_open"
  | "reel_watch";

interface FireEventArgs {
  storeId: string;
  eventName: StorefrontEventName;
  productId?: string;
  value?: number;
  currency?: string;
  metadata?: Record<string, any>;
}

// Pull first-touch attribution from sessionStorage (set by usePageviewBeacon).
// Attaching this to every event lets the dashboard slice funnels by source/ad
// with no extra joins — the metadata jsonb already accepts it.
function readAttribution(): Record<string, string> {
  try {
    const raw = sessionStorage.getItem("__sf_utm__");
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string | null>;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (v) out[k] = String(v).slice(0, 200);
    }
    return out;
  } catch {
    return {};
  }
}


// Module-level dedup: same event for same session+product within 30s collapses.
const recentEvents = new Map<string, number>();
const DEDUP_MS = 30_000;

export function fireStorefrontEvent(args: FireEventArgs): void {
  if (!args.storeId || !args.eventName) return;
  // Bot gate: analytics dashboards must never count bot-driven funnel steps
  // (view_product, add_to_cart, buy_now_click, etc). storefront_events has no
  // is_bot column, so we filter at the source — same UA rules as pageviews.
  if (isLikelyBot()) return;
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

    // pay_click fires twice in a real payment: once for "continue_to_pay" and
    // again for the actual gateway/UPI-app launch (method: upi_gpay, payu, …).
    // Both happen inside 30s, so a step/method-blind key silently swallowed the
    // launch event — we lost all visibility into which UPI app was tapped.
    const variant = String(args.metadata?.step || args.metadata?.method || "");
    const dedupKey = purchaseOrderId
      ? `${args.eventName}:order:${purchaseOrderId}`
      : `${args.eventName}:${variant}:${args.productId || ""}:${sid}`;
    const now = Date.now();
    const last = recentEvents.get(dedupKey);
    if (last && now - last < DEDUP_MS) return;
    recentEvents.set(dedupKey, now);
    if (recentEvents.size > 200) {
      for (const [k, t] of recentEvents) {
        if (now - t > DEDUP_MS) recentEvents.delete(k);
      }
    }

    const row = {
      store_id: args.storeId,
      session_id: sid,
      visitor_id: vid,
      event_name: args.eventName,
      product_id: args.productId || null,
      value: args.value ?? null,
      currency: args.currency || null,
      path: typeof window !== "undefined" ? window.location.pathname.slice(0, 500) : null,
      metadata: { ...(args.metadata || {}), ...readAttribution() },
    };

    // pay_click races the payment-gateway redirect. supabase-js uses plain
    // fetch which the browser aborts on navigation → ~80% of pay_clicks were
    // being lost. Send via keepalive fetch so the request survives unload.
    // Same for purchase (post-payment redirects) and begin_checkout for good
    // measure (some themes hard-navigate on checkout entry).
    const NAV_SAFE = args.eventName === "pay_click"
      || args.eventName === "purchase"
      || args.eventName === "begin_checkout"
      || args.eventName === "reel_watch";

    if (NAV_SAFE && typeof fetch !== "undefined") {
      try {
        fetch(`${SUPA_URL}/rest/v1/storefront_events`, {
          method: "POST",
          keepalive: true,
          headers: {
            "Content-Type": "application/json",
            apikey: SUPA_ANON,
            Authorization: `Bearer ${SUPA_ANON}`,
            Prefer: "return=minimal",
          },
          body: JSON.stringify(row),
        }).catch(() => {});
        return;
      } catch {
        // fall through to supabase-js path
      }
    }

    supabase
      .from("storefront_events" as any)
      .insert(row)
      .then(() => {}, () => {});
  } catch {}
}

