/**
 * Single source of truth for storefront App Store add-on state.
 *
 * Before this, five separate callers (useAppEnabled, useBundleMenu,
 * useUpsellOffers, StorefrontApps, ShopByVideoCarousel, trustVideos) each ran
 * the same RPC under a DIFFERENT React Query key — a cold category load fired
 * it 3x in the same 500ms window, competing with product images for the
 * connection. They now share one query key plus a module-level in-flight
 * promise, so the RPC runs exactly once per slug per page load.
 *
 * PERF (v2): enabled + disabled add-ons used to be TWO RPCs
 * (`get_store_enabled_apps` + `get_store_disabled_apps`) ≈ 800ms of extra
 * round trips on every storefront page. Both now come from one
 * `get_store_apps_state` call; the enabled/disabled hooks are thin selectors
 * over that single query. Falls back to the legacy RPC if the new one is not
 * available yet (older deploys / cached schema).
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface EnabledAppRow {
  app_id: string;
  config: any;
}

export interface AppStateRow extends EnabledAppRow {
  enabled: boolean;
}

const inflight = new Map<string, Promise<AppStateRow[]>>();

export function storeAppsStateKey(storeSlug: string | undefined) {
  return ["store-enabled-apps", storeSlug] as const;
}

/** @deprecated kept for callers that still reference the old key name */
export const storeEnabledAppsKey = storeAppsStateKey;

/** Promise-deduped fetch — safe to call from non-React code paths too. */
export function fetchStoreAppsState(
  storeSlug: string | undefined | null,
): Promise<AppStateRow[]> {
  // Guard: supabase-js strips undefined args, so rpc(..., { _store_slug: undefined })
  // posts `{}` and PostgREST answers 404 (PGRST202 — no zero-arg overload).
  if (!storeSlug) return Promise.resolve([]);
  const existing = inflight.get(storeSlug);
  if (existing) return existing;
  const p = (async () => {
    const { data, error } = await (supabase as any).rpc("get_store_apps_state", {
      _store_slug: storeSlug,
    });
    if (!error) return (data ?? []) as AppStateRow[];
    // Fallback: legacy split RPCs.
    const { data: legacy, error: legacyErr } = await (supabase as any).rpc(
      "get_store_enabled_apps",
      { _store_slug: storeSlug },
    );
    if (legacyErr) throw legacyErr;
    return ((legacy ?? []) as EnabledAppRow[]).map((r) => ({ ...r, enabled: true }));
  })();
  inflight.set(storeSlug, p);
  // Keep the promise around briefly so simultaneous mounts share it, but do not
  // cache failures or stale config forever — React Query owns the real TTL.
  p.catch(() => {}).finally(() => {
    setTimeout(() => inflight.delete(storeSlug), 30_000);
  });
  return p;
}

/** @deprecated use fetchStoreAppsState — kept so old callers keep compiling. */
export function fetchStoreEnabledApps(
  storeSlug: string | undefined | null,
): Promise<EnabledAppRow[]> {
  return fetchStoreAppsState(storeSlug).then((rows) =>
    rows.filter((r) => r.enabled).map(({ app_id, config }) => ({ app_id, config })),
  );
}

function useStoreAppsStateQuery(storeSlug: string | undefined) {
  return useQuery({
    queryKey: storeAppsStateKey(storeSlug),
    enabled: !!storeSlug,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    queryFn: () => fetchStoreAppsState(storeSlug!),
  });
}

export function useStoreAppsState(storeSlug: string | undefined) {
  return useStoreAppsStateQuery(storeSlug);
}

/** Enabled add-ons only — same shape as before this refactor. */
export function useStoreEnabledApps(storeSlug: string | undefined) {
  const q = useStoreAppsStateQuery(storeSlug);
  const data = q.data
    ? q.data.filter((r) => r.enabled).map(({ app_id, config }) => ({ app_id, config }))
    : undefined;
  return { ...q, data } as typeof q & { data: EnabledAppRow[] | undefined };
}
