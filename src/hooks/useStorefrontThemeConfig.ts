import { useQuery, useQueryClient } from "@tanstack/react-query";

/**
 * Reactively subscribe to the storefront-theme-config cache entry.
 *
 * Primary source: cache seeded by StorefrontLayout.logic (from bulk RPC).
 * Fallback: if cache is empty (e.g. direct navigation), fetches from DB.
 *
 * Re-renders whenever the cache is updated via setQueryData (e.g. live preview).
 *
 * STICKY: once a non-null theme_config has been observed for a given storeId,
 * we remember it in a module-level Map and ALWAYS return it on subsequent
 * renders — even if the React Query cache transiently returns undefined
 * (e.g. during background refetch, layout chunk remount, or storeId flicker
 * during SPA navigation). This prevents the "theme flashes to default green
 * + serif + missing mobile nav" bug that appears mid-navigation.
 */
const lastGoodThemeConfig = new Map<string, Record<string, any>>();

function getEdgeThemeConfig(): Record<string, any> | undefined {
  if (typeof window === "undefined") return undefined;
  const hint = (window as any).__THEME__;
  if (!hint || typeof hint !== "object") return undefined;
  return {
    primary_color: hint.pc,
    background_color: hint.bg,
    text_color: hint.tc,
    accent_color: hint.ac,
    heading_font: hint.hf,
    body_font: hint.bf,
    button_style: hint.bs,
    mobile_nav_enabled: hint.mne,
    mobile_nav_style: hint.mns,
    product_card_style: hint.pcs,
    category_style: hint.cs,
    header_logo_alignment: hint.hla,
    header_style: hint.hs,
    marquee_enabled: hint.me,
    marquee_text: hint.mt,
  };
}

export function useStorefrontThemeConfig(
  storeId?: string,
  shellThemeConfig?: Record<string, any> | null
) {
  const queryClient = useQueryClient();
  const queryKey = ["storefront-theme-config", storeId] as const;
  const cachedThemeConfig = queryClient.getQueryData(queryKey) as any;
  const injectedThemeConfig =
    typeof window !== "undefined" &&
    (window as any).__STOREFRONT_DATA__?.store?.id === storeId
      ? (window as any).__STOREFRONT_DATA__?.theme_config
      : undefined;
  const edgeThemeConfig = getEdgeThemeConfig();
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
  const stickyConfig = storeId ? lastGoodThemeConfig.get(storeId) : undefined;
  const initialThemeConfig =
    cachedThemeConfig ?? injectedThemeConfig ?? shellThemeConfig ?? stickyConfig ?? lsThemeConfig ?? edgeThemeConfig;

  // If the shell already brought the full theme_config, skip the separate DB chunk.
  const hasAuthoritativeTheme = !!(injectedThemeConfig || shellThemeConfig);

  const { data: themeConfig } = useQuery({
    queryKey,
    queryFn: async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data, error } = await supabase
        .from("store_theme_config")
        .select("*")
        .eq("store_id", storeId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!storeId && !hasAuthoritativeTheme,
    staleTime: hasAuthoritativeTheme ? Infinity : 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    initialData: initialThemeConfig,
    initialDataUpdatedAt:
      injectedThemeConfig || shellThemeConfig || cachedThemeConfig
        ? Date.now()
        : (stickyConfig || lsThemeConfig || edgeThemeConfig)
          ? 0
          : undefined,
    placeholderData: () => cachedThemeConfig ?? shellThemeConfig ?? stickyConfig ?? lsThemeConfig ?? edgeThemeConfig,
  });

  // Remember the last-good value so future renders never fall back to null
  // when the React Query cache transiently returns undefined.
  if (storeId && themeConfig && typeof themeConfig === "object" && themeConfig !== edgeThemeConfig) {
    lastGoodThemeConfig.set(storeId, themeConfig as Record<string, any>);
    // Also mirror into localStorage so a hard reload picks it up immediately.
    try {
      localStorage.setItem(`sf_tc_${storeId}`, JSON.stringify(themeConfig));
    } catch {}
  }

  const effective = (themeConfig ?? shellThemeConfig ?? stickyConfig ?? lsThemeConfig ?? edgeThemeConfig) as Record<string, any> | null | undefined;

  // PERF: start fetching the selected product-card chunk the moment the theme
  // is known (module-level import(), de-duped) so the first grid paint never
  // waits on a lazy chunk + skeleton flash.
  const cardStyle = effective?.product_card_style;
  if (typeof window !== "undefined" && cardStyle) {
    import("@/components/storefront/UniversalProductCard")
      .then((m) => m.preloadCardStyle(cardStyle))
      .catch(() => {});
  }

  return (effective ?? null) as Record<string, any> | null;

}
