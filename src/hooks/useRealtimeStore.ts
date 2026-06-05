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
 */
export function useRealtimeStore(
  storeId: string | null | undefined,
  scope: "dashboard" | "orders" | "products" = "dashboard"
) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!storeId) return;

    const invalidate = () => {
      qc.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) &&
          (q.queryKey as unknown[]).some((k) => k === storeId),
      });
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
        invalidate
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "products",
          filter: `store_id=eq.${storeId}`,
        },
        invalidate
      )
      .subscribe();

    // Disconnect when tab is hidden for a long time to avoid stale connections.
    let hiddenSince: number | null = null;
    const onVisibility = () => {
      if (document.hidden) {
        hiddenSince = Date.now();
      } else if (hiddenSince && Date.now() - hiddenSince > 15 * 60 * 1000) {
        // Force a refetch on return after long absence
        invalidate();
        hiddenSince = null;
      } else {
        hiddenSince = null;
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      supabase.removeChannel(channel);
    };
  }, [storeId, scope, qc]);
}
