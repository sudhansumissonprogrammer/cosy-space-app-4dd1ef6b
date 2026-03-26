import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Lightweight column list — avoids fetching heavy fields (product_images, product_variants) */
const PRODUCT_COLUMNS =
  "id,category,cost_price,created_at,currency,description,image_url,is_active,is_best_selling,name,price,sale_price,sku,slug,stock_quantity,store_id,updated_at";

const PAGE_SIZE = 20;

/**
 * Shared hook for fetching the first page of storefront products.
 * Used by ALL home page variants (V1–V13) so products load independently
 * of the shell (which no longer includes products).
 *
 * Returns { products, isLoading } — products is always an array (never undefined).
 */
export function useStorefrontProducts(storeId: string | undefined) {
  const { data, isLoading } = useQuery({
    queryKey: ["storefront-products", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(PRODUCT_COLUMNS)
        .eq("store_id", storeId!)
        .eq("is_active", true)
        .order("is_best_selling", { ascending: false })
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .limit(PAGE_SIZE);
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!storeId,
  });

  return { products: data || [], isLoading };
}

export { PRODUCT_COLUMNS, PAGE_SIZE };
