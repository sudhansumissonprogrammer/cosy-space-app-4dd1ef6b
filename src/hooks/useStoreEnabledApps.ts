/**
 * Single source of truth for the `get_store_enabled_apps` RPC.
 *
 * Before this, five separate callers (useAppEnabled, useBundleMenu,
 * useUpsellOffers, StorefrontApps, ShopByVideoCarousel, trustVideos) each ran
 * the same RPC under a DIFFERENT React Query key — a cold category load fired
 * it 3x in the same 500ms window, competing with product images for the
 * connection. They now share one query key plus a module-level in-flight
 * promise, so the RPC runs exactly once per slug per page load.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface EnabledAppRow {
  app_id: string;
  config: any;
}

const inflight = new Map<string, Promise<EnabledAppRow[]>>();

export function storeEnabledAppsKey(storeSlug: string | undefined) {
  return ["store-enabled-apps", storeSlug] as const;
}

/** Promise-deduped fetch — safe to call from non-React code paths too. */
export function fetchStoreEnabledApps(storeSlug: string): Promise<EnabledAppRow[]> {
  const existing = inflight.get(storeSlug);
  if (existing) return existing;
  const p = (async () => {
    const { data, error } = await (supabase as any).rpc("get_store_enabled_apps", {
      _store_slug: storeSlug,
    });
    if (error) throw error;
    return (data ?? []) as EnabledAppRow[];
  })();
  inflight.set(storeSlug, p);
  // Keep the promise around briefly so simultaneous mounts share it, but do not
  // cache failures or stale config forever — React Query owns the real TTL.
  p.catch(() => {}).finally(() => {
    setTimeout(() => inflight.delete(storeSlug), 30_000);
  });
  return p;
}

export function useStoreEnabledApps(storeSlug: string | undefined) {
  return useQuery({
    queryKey: storeEnabledAppsKey(storeSlug),
    enabled: !!storeSlug,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    queryFn: () => fetchStoreEnabledApps(storeSlug!),
  });
}
