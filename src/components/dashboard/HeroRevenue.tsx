import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCountUp } from "@/hooks/useCountUp";
import { TrendingUp, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { endOfDay, startOfDay, subDays } from "date-fns";

interface HeroRevenueProps {
  storeId: string;
  currencySymbol: string;
}

interface SalesAnalyticsPayload {
  total_revenue?: number | string;
  prior_revenue?: number | string;
  total_orders?: number | string;
}

type RpcClient = {
  rpc: <T>(fn: string, args: Record<string, unknown>) => Promise<{
    data: T | null;
    error: Error | null;
  }>;
};

export default function HeroRevenue({ storeId, currencySymbol }: HeroRevenueProps) {
  const { data } = useQuery({
    queryKey: ["hero-revenue", storeId],
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const now = new Date();
      const todayStart = startOfDay(now);
      const yesterdayStart = startOfDay(subDays(now, 1));
      const yesterdayEnd = endOfDay(subDays(now, 1));

      const { data, error } = await (supabase as unknown as RpcClient).rpc<SalesAnalyticsPayload>("get_store_sales_analytics", {
        _store_id: storeId,
        _range_start: todayStart.toISOString(),
        _range_end: now.toISOString(),
        _prior_start: yesterdayStart.toISOString(),
        _prior_end: yesterdayEnd.toISOString(),
      });
      if (error) throw error;

      const todayRevenue = Number(data?.total_revenue ?? 0);
      const yesterdayRevenue = Number(data?.prior_revenue ?? 0);
      const todayOrders = Number(data?.total_orders ?? 0);

      return {
        revenue: todayRevenue,
        orders: todayOrders,
        yesterdayRevenue,
        change: yesterdayRevenue > 0
          ? Math.round(((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100)
          : todayRevenue > 0 ? 100 : 0,
      };
    },
    enabled: !!storeId,
  });

  const animatedRevenue = useCountUp(data?.revenue ?? 0);
  const animatedOrders = useCountUp(data?.orders ?? 0, 800);
  const change = data?.change ?? 0;
  const isUp = change >= 0;

  return (
    <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/10 p-4 sm:p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.12em] mb-1">
            Today's Revenue
          </p>
          <p className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight tabular-nums">
            {currencySymbol}{animatedRevenue.toLocaleString()}
          </p>
          <div className="flex items-center gap-3 mt-1.5">
            <span className="text-xs font-semibold text-muted-foreground">
              {animatedOrders} order{data?.orders !== 1 ? "s" : ""}
            </span>
            {(data?.revenue ?? 0) > 0 || (data?.yesterdayRevenue ?? 0) > 0 ? (
              <span className={`inline-flex items-center gap-0.5 text-[11px] font-bold ${isUp ? "text-success" : "text-destructive"}`}>
                {isUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {Math.abs(change)}% vs yesterday
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
          <TrendingUp className="h-5 w-5 text-primary" />
        </div>
      </div>
    </div>
  );
}
