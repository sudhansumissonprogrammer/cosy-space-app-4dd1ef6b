import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { StoreLocationRecord } from "@/lib/storeLocations";

/**
 * Published store locations / delivery cities for a store.
 * Public RLS exposes only is_published rows; drafts stay invisible here.
 */
export function useStoreLocations(storeId?: string) {
  return useQuery({
    queryKey: ["store-locations", storeId],
    enabled: !!storeId,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_locations")
        .select("*")
        .eq("store_id", storeId!)
        .eq("is_published", true)
        .order("city", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as StoreLocationRecord[];
    },
  });
}
