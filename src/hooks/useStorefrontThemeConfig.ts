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
  const queryKey = ["storefront-theme-config", storeId] as const;
  const cachedThemeConfig = queryClient.getQueryData(queryKey) as any;
  const injectedThemeConfig =
    typeof window !== "undefined" &&
    (window as any).__STOREFRONT_DATA__?.store?.id === storeId
      ? (window as any).__STOREFRONT_DATA__?.theme_config
      : undefined;
  const initialThemeConfig = cachedThemeConfig ?? injectedThemeConfig;

  const { data: themeConfig } = useQuery({
    queryKey,
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
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    initialData: initialThemeConfig,
    initialDataUpdatedAt: initialThemeConfig ? Date.now() : undefined,
    placeholderData: () => cachedThemeConfig,
  });

  return themeConfig as Record<string, any> | null;
}
