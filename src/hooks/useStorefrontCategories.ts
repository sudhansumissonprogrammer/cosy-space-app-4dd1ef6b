import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Reactive storefront categories.
 *
 * Why this exists:
 * Storefront pages used to read categories with `queryClient.getQueryData(...)`,
 * which is a NON-reactive one-shot read. The layout seeds that cache key inside
 * a `useEffect`, and React runs child effects BEFORE parent effects — so on the
 * very first render (a brand-new store, or any cold visit) the page read
 * `undefined` and never re-rendered when the seed landed. Categories only
 * appeared after some other state change forced a re-render (e.g. opening a
 * category and coming back).
 *
 * This hook subscribes to the same query key, so a seeded cache is an instant
 * hit and a cold cache falls back to a direct fetch.
 */
export function useStorefrontCategories(storeId?: string) {
  const { data } = useQuery({
    queryKey: ["storefront-categories", storeId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_storefront_categories", { _store_id: storeId });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!storeId,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  return (data as any[]) ?? undefined;
}
