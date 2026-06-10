import { createContext, useContext, useState, useEffect, useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
// supabase is dynamic-imported inside queryFn (deferred 1s after mount anyway)
// to keep the 171KB supabase chunk OUT of the storefront-shell static graph.

type CountMap = Map<string, number>;

const VariantCountContext = createContext<CountMap | null>(null);

type ProviderProps = {
  /** Legacy: pass all product IDs (forces fetch for all) */
  productIds?: string[];
  /**
   * Preferred: pass product objects so we can skip the network entirely
   * when none of them have `has_variants=true`.
   * Saves ~800ms on storefronts with no variant products.
   */
  products?: Array<{ id: string; has_variants?: boolean | null }>;
  children: ReactNode;
};

/**
 * Batch-fetch variant counts for a list of products in ONE query.
 * Deferred by 1s after mount so product cards render instantly without waiting.
 *
 * Optimization: when `products` is passed, we filter to ones with
 * `has_variants=true`. If no product has variants → no fetch at all.
 */
export function VariantCountProvider({ productIds, products, children }: ProviderProps) {
  // Resolve the list of IDs that actually need fetching.
  const idsToFetch = useMemo<string[]>(() => {
    if (products && products.length > 0) {
      return products.filter((p) => p?.has_variants === true).map((p) => p.id);
    }
    return productIds ?? [];
  }, [productIds, products]);

  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (idsToFetch.length === 0) return;
    const timer = setTimeout(() => setReady(true), 1000);
    return () => clearTimeout(timer);
  }, [idsToFetch.length > 0]);

  const { data: counts } = useQuery({
    queryKey: ["variant-counts-batch", idsToFetch[0] ?? "empty", idsToFetch.length],
    queryFn: async (): Promise<CountMap> => {
      if (idsToFetch.length === 0) return new Map();
      const { supabase } = await import("@/integrations/supabase/client");
      const { data, error } = await supabase
        .from("product_variants")
        .select("product_id")
        .in("product_id", idsToFetch)
        .eq("is_active", true);
      if (error) throw error;
      const map: CountMap = new Map();
      for (const row of data || []) {
        map.set(row.product_id, (map.get(row.product_id) || 0) + 1);
      }
      return map;
    },
    staleTime: 10 * 60 * 1000,
    enabled: ready && idsToFetch.length > 0,
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
