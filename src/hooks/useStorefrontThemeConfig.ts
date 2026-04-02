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
      // Always fetch from DB — this ensures stale cache is properly refreshed.
      // The bulk RPC seeds this cache via setQueryData, so this queryFn only
      // runs on cache miss or when staleTime expires (background refetch).
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
    // If the cache was already seeded by the bulk RPC, use it as placeholder
    // so there's no loading flash — but still allow background refetch
    placeholderData: () =>
      queryClient.getQueryData(["storefront-theme-config", storeId]) as any,
  });

  return themeConfig as Record<string, any> | null;
}
