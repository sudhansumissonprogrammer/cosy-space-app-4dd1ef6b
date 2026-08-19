import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * True once the store has at least one successful (paid) wallet recharge.
 * Used to gate premium menus (e.g. Tracking & Analytics / Pixel integration)
 * until the merchant has completed their first deposit.
 */
export function useFirstRechargeDone(storeId?: string | null) {
  const query = useQuery({
    queryKey: ["store-first-recharge-done", storeId],
    enabled: !!storeId,
    staleTime: 60_000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("store_wallet_recharges")
        .select("id", { count: "exact", head: true })
        .eq("store_id", storeId!)
        .eq("status", "paid");
      if (error) throw error;
      return (count ?? 0) > 0;
    },
  });

  return {
    // Treat unknown/loading as unlocked to avoid flashing a lock screen.
    hasRecharged: query.data ?? true,
    isLoading: query.isLoading,
  };
}
