import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { buildSourcePdpUrl, type SourceProduct } from "@/lib/sourcePdpUrl";

/** Source-platform config for a store (not part of STORE_SETTINGS_COLUMNS). */
export function useStoreSourceConfig(storeId?: string) {
  return useQuery({
    queryKey: ["store-source-config", storeId],
    enabled: !!storeId,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      // `stores` is not readable through the Data API for merchants (no table
      // grant — everything goes through RPCs), so use the ownership-checked
      // security-definer function instead of a direct select.
      const { data, error } = await (supabase as any).rpc("get_store_source_config", {
        p_store_id: storeId!,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return (row || null) as { source_platform: string | null; source_base_url: string | null } | null;
    },
  });
}

/** Supplier PDP link for a single product row (must carry slug/source_* fields). */
export function useProductSourceLink(storeId?: string, product?: SourceProduct) {
  const { data: cfg } = useStoreSourceConfig(storeId);
  return {
    url: buildSourcePdpUrl(cfg, product),
    platform: product?.source_platform || cfg?.source_platform || null,
  };
}

/** Supplier PDP links for a set of product ids (order line items). */
export function useProductSourceLinks(storeId?: string, productIds: string[] = []) {
  const { data: cfg } = useStoreSourceConfig(storeId);
  const ids = [...new Set(productIds.filter(Boolean))].sort();

  const { data: rows } = useQuery({
    queryKey: ["product-source-rows", storeId, ids.join(",")],
    enabled: !!storeId && ids.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("products")
        .select("id, slug, source_path, source_platform")
        .in("id", ids);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const map: Record<string, string> = {};
  for (const r of rows || []) {
    const url = buildSourcePdpUrl(cfg, r);
    if (url) map[r.id] = url;
  }
  return { linkFor: (productId?: string | null) => (productId ? map[productId] || null : null), platform: cfg?.source_platform || null };
}
