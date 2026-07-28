import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  REVIEW_SELECT,
  normalizeReview,
  ratingBreakdown,
  type StoreReview,
} from "@/components/storefront/reviews/reviewTypes";

/**
 * Shared store-review fetch used by the PDP showcase AND the gallery rating
 * badge. Both mount with the same query key, so the reviews load once per
 * session instead of once per component (the badge is free).
 *
 * Only 12 rows are pulled — the PDP shows at most 6 cards + a "view all" tile,
 * and the summary numbers come from the full-count query on the reviews page.
 */
export function useStoreReviews(storeId?: string, limit = 20) {
  const query = useQuery({
    queryKey: ["store-pdp-reviews", storeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("product_reviews")
        .select(REVIEW_SELECT)
        .eq("store_id", storeId!)
        .eq("is_hidden", false)
        .order("pinned_rank", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(limit);
      return (data || []).map(normalizeReview) as StoreReview[];
    },
    enabled: !!storeId,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const reviews = query.data || [];
  const summary = useMemo(() => ratingBreakdown(reviews), [reviews]);

  return { ...query, reviews, ...summary };
}
