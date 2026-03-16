import { useQuery, useQueryClient } from "@tanstack/react-query";

/**
 * Reactively subscribe to the storefront-theme-config cache entry.
 * Unlike queryClient.getQueryData (one-shot), this re-renders
 * whenever the cache is updated via setQueryData (e.g. live preview).
 */
export function useStorefrontThemeConfig(storeId?: string) {
  const queryClient = useQueryClient();

  const { data: themeConfig } = useQuery({
    queryKey: ["storefront-theme-config", storeId],
    queryFn: () => queryClient.getQueryData(["storefront-theme-config", storeId]) ?? null,
    enabled: !!storeId,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  return themeConfig as Record<string, any> | null;
}
