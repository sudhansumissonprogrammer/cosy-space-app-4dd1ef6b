import { useQuery } from "@tanstack/react-query";

const BEST_SELLER_COLUMNS =
  "id,category,currency,description,image_url,is_active,is_best_selling,name,price,sale_price,slug,stock_quantity,store_id,display_order";

/**
 * Fetches ALL best-selling products for a store (no page limit).
 * Sorted by display_order so the merchant's manual order is respected.
 */
export function useBestSellingProducts(storeId: string | undefined) {
  return useQuery({
    queryKey: ["storefront-best-sellers", storeId],
    queryFn: async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data, error } = await supabase
        .from("products")
        .select(BEST_SELLER_COLUMNS)
        .eq("store_id", storeId!)
        .eq("is_active", true)
        .eq("is_best_selling", true)
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!storeId,
  });
}
