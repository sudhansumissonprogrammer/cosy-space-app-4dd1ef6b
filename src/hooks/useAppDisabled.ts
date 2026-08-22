/**
 * useAppDisabled — true when the merchant has an App Store add-on row that is
 * explicitly switched OFF for this storefront.
 *
 * Needed for add-ons that are ON by default for every store (so they cannot be
 * gated by `get_store_enabled_apps`, which only ever returns enabled rows).
 * The query is opt-in via `active` so storefronts that never touch the feature
 * pay zero extra round trips.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useStoreDisabledApps(storeSlug: string | undefined, active = true) {
  return useQuery({
    queryKey: ["store-disabled-apps", storeSlug],
    enabled: !!storeSlug && active,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_store_disabled_apps", {
        _store_slug: storeSlug,
      });
      if (error) throw error;
      return ((data ?? []) as Array<{ app_id: string }>).map((r) => r.app_id);
    },
  });
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
