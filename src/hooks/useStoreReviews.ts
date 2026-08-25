import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  normalizeReview,
  ratingBreakdown,
  type StoreReview,
} from "@/components/storefront/reviews/reviewTypes";

/**
 * Shared store-review fetch used by the PDP showcase AND the gallery rating
 * badge.
 *
 * Perf: this used to run TWO queries — the display list plus a `limit=5000`
 * download of every rating in the store just to compute the average. On a
 * 15k-product store that was the single heaviest payload on the PDP. It is
 * now ONE `get_store_review_summary` RPC that returns the capped display list
 * and the aggregate (total / average / star counts) computed in Postgres.
 */
export function useStoreReviews(storeId?: string, limit = 20) {
  const query = useQuery({
    queryKey: ["store-pdp-reviews", storeId, limit],
    queryFn: async () => {
      const { data } = await (supabase as any).rpc("get_store_review_summary", {
        _store_id: storeId!,
        _limit: limit,
      });
      const payload = (Array.isArray(data) ? data[0] : data) || {};
      const counts = payload.counts || {};
      return {
        reviews: (payload.reviews || []).map(normalizeReview) as StoreReview[],
        summary: {
          counts: {
            5: Number(counts["5"] || 0),
            4: Number(counts["4"] || 0),
            3: Number(counts["3"] || 0),
            2: Number(counts["2"] || 0),
            1: Number(counts["1"] || 0),
          } as Record<number, number>,
          total: Number(payload.total || 0),
          average: Number(payload.average || 0),
        },
      };
    },
    enabled: !!storeId,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const reviews = query.data?.reviews || [];
  const summary = useMemo(
    () => query.data?.summary || ratingBreakdown([]),
    [query.data?.summary],
  );

  return { ...query, reviews, ...summary };
}
