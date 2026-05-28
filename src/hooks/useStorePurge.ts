/**
 * Tiny helper that returns a `purge()` function for the current store.
 *
 * Call this after any successful save in a dashboard page so the Cloudflare
 * Worker edge cache is invalidated and shoppers see the latest data instantly.
 *
 * Pass `{ shell: true }` only when the change affects the SPA shell or
 * prebuilt head (theme tokens, menu config, slug rename). Product / category /
 * coupon / page-content / shipping / tax / payment saves should use the
 * default (data-only) purge to avoid wasting KV writes on the re-warm chain.
 *
 * Usage:
 *   const purge = useStorePurge(storeId);
 *   onSuccess: () => { toast.success("..."); purge(); }
 *   // theme/menu save:
 *   onSuccess: () => { toast.success("..."); purge({ shell: true }); }
 */
import { useCallback } from "react";
import { useStoreData } from "@/hooks/useStoreData";

interface PurgeOptions {
  shell?: boolean;
}

export function useStorePurge(storeId: string | null | undefined) {
  const { data: store } = useStoreData(storeId ?? undefined);

  return useCallback(
    (opts: PurgeOptions = {}) => {
      if (!store?.slug) return;
      import("@/lib/purgeStoreCache")
        .then(({ purgeStoreCache }) =>
          purgeStoreCache(store.slug, (store as any).custom_domain, opts)
        )
        .catch(() => {});
    },
    [store?.slug, (store as any)?.custom_domain]
  );
}
