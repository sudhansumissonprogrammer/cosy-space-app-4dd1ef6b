import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCountUp } from "@/hooks/useCountUp";
import { TrendingUp, ArrowUpRight, ArrowDownRight } from "lucide-react";

interface HeroRevenueProps {
  storeId: string;
  currencySymbol: string;
}

export default function HeroRevenue({ storeId, currencySymbol }: HeroRevenueProps) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);

  const { data } = useQuery({
    queryKey: ["hero-revenue", storeId],
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const todayIso = todayStart.toISOString();
      const yesterdayIso = yesterdayStart.toISOString();

      // Revenue counts only confirmed, shipped, delivered, or partially_paid orders.
      // Pending orders are excluded even if they have an advance payment.
      const REVENUE_STATUSES = ["confirmed", "shipped", "delivered", "partially_paid"];

      const [todayRes, yesterdayRes] = await Promise.all([
        supabase
          .from("orders")
          .select("total")
          .eq("store_id", storeId)
          .gte("created_at", todayIso)
          .in("status", REVENUE_STATUSES),
        supabase
          .from("orders")
          .select("total")
          .eq("store_id", storeId)
          .gte("created_at", yesterdayIso)
          .lt("created_at", todayIso)
          .in("status", REVENUE_STATUSES),
      ]);

      const todayOrders = todayRes.data || [];
      const yesterdayOrders = yesterdayRes.data || [];
      const todayRevenue = todayOrders.reduce((s, o) => s + Number(o.total || 0), 0);
      const yesterdayRevenue = yesterdayOrders.reduce((s, o) => s + Number(o.total || 0), 0);

      return {
        revenue: todayRevenue,
        orders: todayOrders.length,
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
              <span className={`inline-flex items-center gap-0.5 text-[11px] font-bold ${isUp ? "text-emerald-600" : "text-red-500"}`}>
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
