import { useQuery } from "@tanstack/react-query";
import { fetchStoreEnabledApps, storeEnabledAppsKey } from "@/hooks/useStoreEnabledApps";
import { supabase } from "@/integrations/supabase/client";
import {
  UPSELL_APP_ID,
  type UpsellOffer,
  type UpsellPlacement,
} from "@/lib/appStore/upsell/types";
import { matchOffers, type UpsellContext } from "@/lib/appStore/upsell/matchEngine";

/** Reads the enabled Upsell offers via the existing get_store_enabled_apps RPC. */
export function useUpsellOffers(storeSlug: string | undefined) {
  return useQuery({
    queryKey: [...storeEnabledAppsKey(storeSlug), "upsell"],
    enabled: !!storeSlug,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<UpsellOffer[]> => {
      const data = await fetchStoreEnabledApps(storeSlug!);
      const row = (data ?? []).find((r: any) => r.app_id === UPSELL_APP_ID);
      if (!row) return [];
      return ((row.config?.offers ?? []) as UpsellOffer[]).filter(
        (o) => o && o.active !== false
      );
    },
  });
}

/** Convenience: matched offers for a given placement + cart/PDP context. */
export function useMatchedUpsellOffers(
  storeSlug: string | undefined,
  ctx: UpsellContext,
  placement: UpsellPlacement
): UpsellOffer[] {
  const q = useUpsellOffers(storeSlug);
  if (!q.data) return [];
  return matchOffers(q.data, { ...ctx, placement });
}