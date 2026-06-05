// Storefront analytics events — fire-and-forget funnel tracking.
// Writes to public.storefront_events. Never blocks UX; all errors swallowed.
import { supabase } from "@/integrations/supabase/client";
import { getOrCreateSessionId, getVisitorId } from "@/lib/visitorSession";

export type StorefrontEventName =
  | "view_product"
  | "add_to_cart"
  | "begin_checkout"
  | "purchase";

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
    const dedupKey = `${args.eventName}:${args.productId || ""}:${sid}`;
    const now = Date.now();
    const last = recentEvents.get(dedupKey);
    if (last && now - last < DEDUP_MS && args.eventName !== "purchase") return;
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
