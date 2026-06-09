import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";

const BEST_SELLER_COLUMNS =
  "id,category,currency,description,image_url,is_active,is_best_selling,name,price,sale_price,slug,stock_quantity,store_id,display_order";

export const BEST_SELLER_PAGE_SIZE = 20;

/**
 * Phase 3 (v8.36): try to seed the first page from window.__STOREFRONT_DATA__.products_preview
 * which is ordered with best_selling first. Saves one REST round-trip on cold loads.
 */
function getInlinedBestSellers(storeId: string): any[] | null {
  if (typeof window === "undefined") return null;
  try {
    const sd: any = (window as any).__STOREFRONT_DATA__;
    if (!sd?.products_preview || !Array.isArray(sd.products_preview)) return null;
    if (sd?.store?.id && sd.store.id !== storeId) return null;
    // Prefer products explicitly flagged is_best_selling.
    const bests = sd.products_preview.filter((p: any) => p?.is_best_selling === true);
    if (bests.length > 0) return bests;
    // Fallback (v8.51): merchant hasn't tagged any best-sellers → use the
    // preview as-is. The DB orders products_preview by
    // is_best_selling DESC, created_at DESC so we get newest products,
    // which is a sensible implicit "popular" surface. Kills the 878ms
    // REST round-trip on cold home loads for stores without tagged BS.
    return sd.products_preview.slice(0, BEST_SELLER_PAGE_SIZE);
  } catch {
    return null;
  }
}

/**
 * Fetches best-selling products with infinite scroll (20 per page).
 * Sorted by display_order so the merchant's manual order is respected.
 */
export function useBestSellingProducts(storeId: string | undefined) {
  const query = useInfiniteQuery({
    queryKey: ["storefront-best-sellers", storeId],
    queryFn: async ({ pageParam = 0 }) => {
      // Page 0: prefer inlined preview to skip the REST round-trip.
      if (pageParam === 0 && storeId) {
        const inlined = getInlinedBestSellers(storeId);
        if (inlined && inlined.length > 0) {
          return { products: inlined.slice(0, BEST_SELLER_PAGE_SIZE), page: 0 };
        }
      }
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
