import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Batch-fetch variant counts for a list of product IDs in ONE query.
 * Replaces the previous N individual queries in UniversalProductCard.
 *
 * Returns a Map<productId, variantCount>.
 */
export function useVariantCounts(productIds: string[]) {
  return useQuery({
    queryKey: ["variant-counts-batch", ...productIds.slice(0, 5)],
    queryFn: async () => {
      if (productIds.length === 0) return new Map<string, number>();

      // Single query: get all active variants grouped by product_id
      const { data, error } = await supabase
        .from("product_variants")
        .select("product_id")
        .in("product_id", productIds)
        .eq("is_active", true);

      if (error) throw error;

      const counts = new Map<string, number>();
      for (const row of data || []) {
        counts.set(row.product_id, (counts.get(row.product_id) || 0) + 1);
      }
      return counts;
    },
    staleTime: 10 * 60 * 1000,
    enabled: productIds.length > 0,
  });
}
