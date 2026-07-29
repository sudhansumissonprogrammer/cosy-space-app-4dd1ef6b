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
 * badge. The display list is capped at `limit` for the carousel, but the
 * summary (total, average, star counts) is computed off a full-store fetch
 * of just id+rating so the "Based on X reviews" copy reflects reality.
 */
export function useStoreReviews(storeId?: string, limit = 20) {
  const query = useQuery({
    queryKey: ["store-pdp-reviews", storeId, limit],
    queryFn: async () => {
      const [displayRes, summaryRes] = await Promise.all([
        supabase
          .from("product_reviews")
          .select(REVIEW_SELECT)
          .eq("store_id", storeId!)
          .eq("is_hidden", false)
          .order("pinned_rank", { ascending: true, nullsFirst: false })
          .order("created_at", { ascending: false })
          .limit(limit),
        supabase
          .from("product_reviews")
          .select("rating")
          .eq("store_id", storeId!)
          .eq("is_hidden", false)
          .limit(5000),
      ]);
      return {
        reviews: (displayRes.data || []).map(normalizeReview) as StoreReview[],
        allRatings: (summaryRes.data || []).map((r: any) => ({ rating: r.rating })),
      };
    },
    enabled: !!storeId,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const reviews = query.data?.reviews || [];
  const allRatings = query.data?.allRatings || [];
  const summary = useMemo(() => ratingBreakdown(allRatings), [allRatings]);

  return { ...query, reviews, ...summary };
}
