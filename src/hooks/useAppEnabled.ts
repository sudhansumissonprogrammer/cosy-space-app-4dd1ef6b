/**
 * useAppEnabled — returns true if the given App Store add-on is installed
 * AND enabled for the given storefront slug. Backed by the shared
 * `useStoreEnabledApps` query so every add-on consumer on a page reuses one
 * single `get_store_enabled_apps` round trip.
 */
import { useStoreEnabledApps } from "@/hooks/useStoreEnabledApps";

export function useAppEnabled(
  storeSlug: string | undefined,
  appId: string,
): { enabled: boolean; isLoading: boolean } {
  const q = useStoreEnabledApps(storeSlug);
  const enabled = !!q.data?.some((r) => r.app_id === appId);
  return { enabled, isLoading: q.isLoading };
}
