import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Phase 1 realtime: subscribe to orders + products for a store and invalidate
 * any React Query that references this storeId in its queryKey.
 *
 * - Pairs with existing 30–120s React Query polling (websocket loss safe).
 * - Filters at subscription level so payloads are scoped to one store.
 * - Single channel per (storeId, scope) to keep connection count low.
 *
 * Performance guards (added after the dashboard-load audit):
 *  - Invalidations are debounced (trailing, 2.5s) so a bulk catalog sync that
 *    writes thousands of product rows triggers ONE refetch, not thousands.
 *  - Invalidation is scoped by source table: an `orders` event never refetches
 *    the (expensive) products list and vice-versa.
 *  - Nothing refetches while the tab is hidden; a single catch-up invalidation
 *    runs when the merchant comes back.
 */

const ORDER_KEY_HINTS = [
  "order",
  "dashboard",
  "stats",
  "sales",
  "revenue",
  "customer",
  "insight",
  "pending",
  "analytics",
];
const PRODUCT_KEY_HINTS = ["product", "categor", "inventory", "stock", "dashboard", "stats"];

function matchesStore(key: unknown[], storeId: string) {
  return key.some((k) => k === storeId);
}

function matchesHints(key: unknown[], hints: string[]) {
  const head = typeof key[0] === "string" ? (key[0] as string).toLowerCase() : "";
  if (!head) return true;
  return hints.some((h) => head.includes(h));
}

export function useRealtimeStore(
  storeId: string | null | undefined,
  scope: "dashboard" | "orders" | "products" = "dashboard"
) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!storeId) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    let pendingOrders = false;
    let pendingProducts = false;
    let missedWhileHidden = false;

    const flush = () => {
      timer = null;
      if (document.hidden) {
        missedWhileHidden = true;
        return;
      }
      const orders = pendingOrders;
      const products = pendingProducts;
      pendingOrders = false;
      pendingProducts = false;
      if (!orders && !products) return;

      qc.invalidateQueries({
        predicate: (q) => {
          if (!Array.isArray(q.queryKey)) return false;
          const key = q.queryKey as unknown[];
          if (!matchesStore(key, storeId)) return false;
          if (orders && matchesHints(key, ORDER_KEY_HINTS)) return true;
          if (products && matchesHints(key, PRODUCT_KEY_HINTS)) return true;
          return false;
        },
      });
    };

    const schedule = (table: "orders" | "products") => {
      if (table === "orders") pendingOrders = true;
      else pendingProducts = true;
      if (timer) return;
      timer = setTimeout(flush, 2500);
    };

    const channel = supabase
      .channel(`store-rt-${scope}-${storeId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `store_id=eq.${storeId}`,
        },
        () => schedule("orders")
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "products",
          filter: `store_id=eq.${storeId}`,
        },
        () => schedule("products")
      )
      .subscribe();

    const onVisibility = () => {
      if (document.hidden) return;
      if (missedWhileHidden || pendingOrders || pendingProducts) {
        missedWhileHidden = false;
        pendingOrders = true;
        pendingProducts = true;
        if (timer) clearTimeout(timer);
        timer = setTimeout(flush, 300);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      supabase.removeChannel(channel);
    };
  }, [storeId, scope, qc]);
}
