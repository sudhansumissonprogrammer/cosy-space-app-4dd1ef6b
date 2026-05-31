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
  // localStorage fallback — keeps merchant's last-saved selections (nav style,
  // card style, colors, etc.) rendered on first paint when worker injection
  // isn't available. Prevents the "default flash → selected" waterfall.
  let lsThemeConfig: any = undefined;
  if (typeof window !== "undefined" && storeId && !cachedThemeConfig && !injectedThemeConfig) {
    try {
      const raw = localStorage.getItem(`sf_tc_${storeId}`);
      if (raw) lsThemeConfig = JSON.parse(raw);
    } catch {}
  }
  const initialThemeConfig = cachedThemeConfig ?? injectedThemeConfig ?? lsThemeConfig;

  // Phase 1: If Worker injected theme_config, skip the Supabase chunk load entirely.
  // Saves ~45KB of JS + ~400ms of network time on cold load. Live preview still works
  // because useThemePreview writes directly to the cache via setQueryData.
  const hasInjectedTheme = !!injectedThemeConfig;

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
    // Disable the query when Worker already injected the theme — no refetch needed.
    enabled: !!storeId && !hasInjectedTheme,
    staleTime: hasInjectedTheme ? Infinity : 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    initialData: initialThemeConfig,
    // Trust injected/cache as fresh (worker purges on save). Mark localStorage
    // fallback as stale so we render it instantly but still revalidate from DB.
    initialDataUpdatedAt:
      injectedThemeConfig || cachedThemeConfig
        ? Date.now()
        : lsThemeConfig
          ? 0
          : undefined,
    placeholderData: () => cachedThemeConfig,
  });

  return themeConfig as Record<string, any> | null;
}
