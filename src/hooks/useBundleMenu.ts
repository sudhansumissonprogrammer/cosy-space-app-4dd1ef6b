import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { BundleDef } from "@/lib/appStore/bundle/types";
import { BUNDLE_APP_ID } from "@/lib/appStore/bundle/types";

/**
 * Reads the active bundles for a storefront via the existing
 * get_store_enabled_apps RPC. Returns only bundles where is_active=true.
 * When the app is disabled/uninstalled, returns [].
 *
 * Storefront-safe: anon-callable RPC, cached 5 min.
 */
export function useBundleMenu(storeSlug: string | undefined) {
  return useQuery({
    queryKey: ["storefront-bundles", storeSlug],
    enabled: !!storeSlug,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<BundleDef[]> => {
      const { data, error } = await (supabase as any).rpc("get_store_enabled_apps", {
        _store_slug: storeSlug!,
      });
      if (error) throw error;
      const row = (data ?? []).find((r: any) => r.app_id === BUNDLE_APP_ID);
      if (!row) return [];
      const bundles = (row.config?.bundles ?? []) as BundleDef[];
      return bundles
        .filter((b) => b && b.is_active !== false && !!b.slug)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    },
  });
}

/** Look up a single active bundle by slug. */
export function useBundleBySlug(storeSlug: string | undefined, bundleSlug: string | undefined) {
  const q = useBundleMenu(storeSlug);
  return {
    ...q,
    bundle: q.data?.find((b) => b.slug === bundleSlug) || null,
  };
}