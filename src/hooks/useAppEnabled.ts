/**
 * useAppEnabled — returns true if the given App Store add-on is installed
 * AND enabled for the given storefront slug. Backed by the same
 * `get_store_enabled_apps` RPC used by StorefrontApps / useUpsellOffers,
 * so the read is deduped via React Query.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useAppEnabled(
  storeSlug: string | undefined,
  appId: string,
): { enabled: boolean; isLoading: boolean } {
  const q = useQuery({
    queryKey: ["store-enabled-apps", storeSlug],
    enabled: !!storeSlug,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc(
        "get_store_enabled_apps",
        { _store_slug: storeSlug! },
      );
      if (error) throw error;
      return (data ?? []) as Array<{ app_id: string; config: any }>;
    },
  });
  const enabled = !!q.data?.some((r) => r.app_id === appId);
  return { enabled, isLoading: q.isLoading };
}
