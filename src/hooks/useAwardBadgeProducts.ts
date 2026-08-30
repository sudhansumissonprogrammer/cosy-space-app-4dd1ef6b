import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Product IDs in a store that carry the "Best Seller" award seal.
 *
 * Card/PDP payloads come from several sources (edge-cached RPC snapshots,
 * shell previews, REST selects) and not all of them carry the `award_badge`
 * column. Merchants only flag a handful of products, so one tiny per-store
 * query (ids only) is cheaper and far more reliable than widening every
 * payload. React Query de-dupes it across the whole grid.
 */
export function useAwardBadgeProducts(storeId?: string | null): Set<string> {
  const { data } = useQuery({
    queryKey: ["award-badge-products", storeId],
    queryFn: async () => {
      // Public storefront visitors cannot read `products` directly (no anon
      // grant) — a SECURITY DEFINER RPC returns just the flagged ids.
      const { data, error } = await (supabase as any).rpc("get_award_badge_products", {
        _store_id: storeId!,
      });
      if (error) throw error;
      return (data || []).map((r: any) => r.id as string);
    },

    enabled: !!storeId,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return new Set(data || []);
}

/** True when this product should show the award seal. */
export function hasAwardBadge(product: any, ids: Set<string>): boolean {
  if (product?.award_badge === true) return true;
  return !!product?.id && ids.has(product.id);
}
