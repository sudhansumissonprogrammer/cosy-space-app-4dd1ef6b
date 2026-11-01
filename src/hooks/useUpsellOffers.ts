import { useMemo } from "react";
import { useStoreEnabledApps } from "@/hooks/useStoreEnabledApps";
import {
  UPSELL_APP_ID,
  type UpsellOffer,
  type UpsellPlacement,
} from "@/lib/appStore/upsell/types";
import { matchOffers, type UpsellContext } from "@/lib/appStore/upsell/matchEngine";

/** Reads the enabled Upsell offers via the existing get_store_enabled_apps RPC. */
export function useUpsellOffers(storeSlug: string | undefined) {
  const query = useStoreEnabledApps(storeSlug);
  const data = useMemo(() => {
    if (!query.data) return undefined;
    const row = query.data.find((app) => app.app_id === UPSELL_APP_ID);
    return ((row?.config?.offers ?? []) as UpsellOffer[]).filter((offer) => offer && offer.active !== false);
  }, [query.data]);
  return { ...query, data };
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