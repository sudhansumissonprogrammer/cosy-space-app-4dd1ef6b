import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Single source for the dashboard-home summary.
 *
 * `get_dashboard_stats` now also returns pending-order / abandoned-cart counts
 * and the store-setup flags the checklist needs, so Dashboard, PendingActions
 * and StoreChecklist all share ONE request (was 1 RPC + 2 head-counts + 5
 * setup reads on every dashboard mount).
 */
export interface DashboardStats {
  total_products: number;
  total_orders: number;
  total_customers: number;
  total_views: number;
  pending_orders: number;
  abandoned_carts: number;
  setup: {
    logo_url: string | null;
    banner_url: string | null;
    whatsapp_number: string | null;
    description: string | null;
    order_mode: string | null;
    owner_name: string | null;
    has_payments: boolean;
    has_shipping: boolean;
    has_theme: boolean;
  };
}

const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

export function dashboardStatsKey(storeId: string | undefined) {
  return ["dashboard-stats", storeId];
}

export function useDashboardStats(storeId: string | undefined) {
  return useQuery({
    queryKey: dashboardStatsKey(storeId),
    staleTime: 5 * 60 * 1000,
    enabled: !!storeId,
    queryFn: async (): Promise<DashboardStats> => {
      const { data, error } = await supabase.rpc("get_dashboard_stats", { _store_id: storeId! });
      if (error) throw error;
      const s = (data ?? {}) as Record<string, unknown>;
      const setup = (s.setup ?? {}) as Record<string, unknown>;
      return {
        total_products: Number(s.total_products ?? 0),
        total_orders: Number(s.total_orders ?? 0),
        total_customers: Number(s.total_customers ?? 0),
        total_views: Number(s.total_views ?? 0),
        pending_orders: Number(s.pending_orders ?? 0),
        abandoned_carts: Number(s.abandoned_carts ?? 0),
        setup: {
          logo_url: str(setup.logo_url),
          banner_url: str(setup.banner_url),
          whatsapp_number: str(setup.whatsapp_number),
          description: str(setup.description),
          order_mode: str(setup.order_mode),
          owner_name: str(setup.owner_name),
          has_payments: !!setup.has_payments,
          has_shipping: !!setup.has_shipping,
          has_theme: !!setup.has_theme,
        },
      };
    },
  });
}
