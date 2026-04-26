import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface BillingState {
  plan_id: string;
  plan_name: string;
  plan_slug: string;
  price: number;
  currency: string;
  is_free_lifetime: boolean;
  is_one_time: boolean;
  billing_status: "trialing" | "active" | "past_due" | "suspended" | "cancelled" | "lifetime" | "one_time_paid";
  trial_ends_at: string | null;
  current_period_end: string | null;
  grace_period_ends_at: string | null;
  last_payment_at: string | null;
  is_suspended: boolean;
  days_until_action: number | null;
  requires_payment: boolean;
}

/** Single source of truth for a store's billing state. Cached 60s. */
export function useBillingState(storeId: string | null | undefined) {
  return useQuery({
    queryKey: ["billing-state", storeId],
    queryFn: async (): Promise<BillingState | null> => {
      if (!storeId) return null;
      const { data, error } = await supabase.rpc("get_store_billing_state", { _store_id: storeId });
      if (error) throw error;
      return (data as unknown as BillingState) ?? null;
    },
    enabled: !!storeId,
    staleTime: 60_000,
  });
}
