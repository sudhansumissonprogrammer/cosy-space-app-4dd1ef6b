/**
 * Tiny helper that returns a `purge()` function for the current store.
 *
 * Call this after any successful save in a dashboard page so the Cloudflare
 * Worker edge cache is invalidated and shoppers see the latest data instantly.
 *
 * Usage:
 *   const purge = useStorePurge(storeId);
 *   onSuccess: () => { toast.success("..."); purge(); }
 */
import { useCallback } from "react";
import { useStoreData } from "@/hooks/useStoreData";

export function useStorePurge(storeId: string | null | undefined) {
  const { data: store } = useStoreData(storeId ?? undefined);

  return useCallback(() => {
    if (!store?.slug) return;
    import("@/lib/purgeStoreCache")
      .then(({ purgeStoreCache }) =>
        purgeStoreCache(store.slug, (store as any).custom_domain)
      )
      .catch(() => {});
  }, [store?.slug, (store as any)?.custom_domain]);
}
