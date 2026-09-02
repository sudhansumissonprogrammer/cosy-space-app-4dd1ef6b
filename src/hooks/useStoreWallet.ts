import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Wallet summary for a store.
 *
 * Both DashboardLayout (low-balance gate) and the Overview page (wallet card /
 * commission mode) need this. It lived as two identical copies of the same
 * useQuery block — one hook keeps them in sync.
 */
export function useStoreWallet(storeId: string | undefined) {
  return useQuery({
    queryKey: ["store-wallet", storeId],
    enabled: !!storeId,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_store_wallet_summary", { _store_id: storeId! });
      if (error) throw error;
      return data as any;
    },
  });
}

/** Commission billing is driven by the store row, with the wallet as fallback. */
export function isCommissionBilling(store: unknown, walletSummary: unknown): boolean {
  return (
    (store as any)?.billing_mode === "commission" ||
    (walletSummary as any)?.billing_mode === "commission"
  );
}
