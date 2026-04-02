import { useQuery, useQueryClient } from "@tanstack/react-query";

/**
 * Reactively subscribe to the storefront-theme-config cache entry.
 * 
 * Primary source: cache seeded by StorefrontLayout.logic (from bulk RPC).
 * Fallback: if cache is empty (e.g. direct navigation), fetches from DB.
 * 
 * Re-renders whenever the cache is updated via setQueryData (e.g. live preview).
 */
export function useStorefrontThemeConfig(storeId?: string) {
  const queryClient = useQueryClient();

  const { data: themeConfig } = useQuery({
    queryKey: ["storefront-theme-config", storeId],
    queryFn: async () => {
      // First check if cache was already seeded by the bulk query
      const cached = queryClient.getQueryData(["storefront-theme-config", storeId]);
      if (cached) return cached;

      // Fallback: fetch directly from DB (handles edge case where
      // bulk query hasn't seeded the cache yet, e.g. on refresh)
      const { supabase } = await import("@/integrations/supabase/client");
      const { data, error } = await supabase
        .from("store_theme_config")
        .select("*")
        .eq("store_id", storeId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!storeId,
    staleTime: 60_000, // Allow refetch after 1 min to pick up changes
    gcTime: 10 * 60 * 1000,
  });

  return themeConfig as Record<string, any> | null;
}
