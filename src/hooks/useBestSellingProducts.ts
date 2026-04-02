import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";

const BEST_SELLER_COLUMNS =
  "id,category,currency,description,image_url,is_active,is_best_selling,name,price,sale_price,slug,stock_quantity,store_id,display_order";

export const BEST_SELLER_PAGE_SIZE = 12;

/**
 * Fetches best-selling products with infinite scroll (12 per page).
 * Sorted by display_order so the merchant's manual order is respected.
 */
export function useBestSellingProducts(storeId: string | undefined) {
  const query = useInfiniteQuery({
    queryKey: ["storefront-best-sellers", storeId],
    queryFn: async ({ pageParam = 0 }) => {
      const { supabase } = await import("@/integrations/supabase/client");
      const offset = pageParam * BEST_SELLER_PAGE_SIZE;
      const { data, error } = await supabase
        .from("products")
        .select(BEST_SELLER_COLUMNS)
        .eq("store_id", storeId!)
        .eq("is_active", true)
        .eq("is_best_selling", true)
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: false })
        .range(offset, offset + BEST_SELLER_PAGE_SIZE - 1);
      if (error) throw error;
      return { products: data || [], page: pageParam };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      lastPage.products.length === BEST_SELLER_PAGE_SIZE
        ? lastPage.page + 1
        : undefined,
    staleTime: 5 * 60 * 1000,
    enabled: !!storeId,
  });

  const flatProducts = useMemo(
    () => query.data?.pages.flatMap((p) => p.products) ?? [],
    [query.data],
  );

  return {
    ...query,
    /** Flattened array of all loaded best-selling products */
    products: flatProducts,
  };
}
