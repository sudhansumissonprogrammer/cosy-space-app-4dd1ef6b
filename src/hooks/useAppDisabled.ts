/**
 * useAppDisabled — true when the merchant has an App Store add-on row that is
 * explicitly switched OFF for this storefront.
 *
 * Needed for add-ons that are ON by default for every store (so they cannot be
 * gated by the enabled-only list).
 *
 * PERF: this used to run its own `get_store_disabled_apps` RPC, doubling the
 * add-on round trips on every storefront page. It now reads the shared
 * `get_store_apps_state` query (one request for enabled + disabled).
 */
import { useStoreAppsState } from "@/hooks/useStoreEnabledApps";

export function useStoreDisabledApps(storeSlug: string | undefined, active = true) {
  const q = useStoreAppsState(active ? storeSlug : undefined);
  const data = q.data
    ? q.data.filter((r) => !r.enabled).map((r) => r.app_id)
    : undefined;
  return { ...q, data } as typeof q & { data: string[] | undefined };
}

/** Default-on add-ons: returns true only once we know it was turned off. */
export function useAppDisabled(
  storeSlug: string | undefined,
  appId: string,
  active = true,
): boolean {
  const q = useStoreDisabledApps(storeSlug, active);
  return !!q.data?.includes(appId);
}
