import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
// supabase is dynamic-imported inside queryFn (deferred 1s after mount anyway)
// to keep the 171KB supabase chunk OUT of the storefront-shell static graph.

type CountMap = Map<string, number>;

const VariantCountContext = createContext<CountMap | null>(null);

/**
 * Batch-fetch variant counts for a list of products in ONE query.
 * Deferred by 1s after mount so product cards render instantly without waiting.
 */
export function VariantCountProvider({ productIds, children }: { productIds: string[]; children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (productIds.length === 0) return;
    const timer = setTimeout(() => setReady(true), 1000);
    return () => clearTimeout(timer);
  }, [productIds.length > 0]);

  const { data: counts } = useQuery({
    queryKey: ["variant-counts-batch", productIds.length > 0 ? productIds[0] : "empty", productIds.length],
    queryFn: async (): Promise<CountMap> => {
      if (productIds.length === 0) return new Map();
      const { data, error } = await supabase
        .from("product_variants")
        .select("product_id")
        .in("product_id", productIds)
        .eq("is_active", true);
      if (error) throw error;
      const map: CountMap = new Map();
      for (const row of data || []) {
        map.set(row.product_id, (map.get(row.product_id) || 0) + 1);
      }
      return map;
    },
    staleTime: 10 * 60 * 1000,
    enabled: ready && productIds.length > 0,
  });

  return (
    <VariantCountContext.Provider value={counts ?? null}>
      {children}
    </VariantCountContext.Provider>
  );
}

/** Get variant count for a single product. Returns 0 if provider is missing or count unknown. */
export function useVariantCount(productId: string): number {
  const counts = useContext(VariantCountContext);
  return counts?.get(productId) ?? 0;
}
