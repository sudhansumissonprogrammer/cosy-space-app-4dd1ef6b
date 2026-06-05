import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShoppingBag, TrendingUp, Users, Eye, ArrowUpRight, BarChart3 } from "lucide-react";
import { useNavigateTransition } from "@/hooks/useNavigateTransition";

interface Props {
  storeId: string;
  storeSlug: string;
  currencySymbol: string;
}

export default function TodayInsights({ storeId, storeSlug, currencySymbol }: Props) {
  const { navigate } = useNavigateTransition();

  // Use a stable day-key (YYYY-MM-DD in browser-local time) so the queryKey
  // rolls over automatically at midnight even if the tab stays open.
  const todayKey = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  })();

  const { data } = useQuery({
    queryKey: ["today-insights", storeId, todayKey],
    // Refetch every 60s while the tab is open so "Today" actually advances
    // through the day instead of freezing on the first snapshot.
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
    staleTime: 30_000,
    enabled: !!storeId,
    queryFn: async () => {
      // Exact backend aggregate: avoids browser row caps, stale cached rows,
      // and timezone drift for high-traffic stores.
      const { data, error } = await (supabase as any).rpc("get_today_analytics", {
        _store_id: storeId,
      });
      if (error) throw error;

      const orders = Number(data?.orders ?? 0);
      const sessions = Number(data?.sessions ?? 0);
      const visitors = Number(data?.visitors ?? 0);
      const revenue = Number(data?.revenue ?? 0);
      const conversion = sessions > 0 ? (orders / sessions) * 100 : 0;

      return {
        orders,
        revenue,
        sessions,
        visitors,
        conversion,
      };
    },
  });


  const tiles = [
    { label: "Orders", value: data?.orders ?? 0, icon: ShoppingBag, color: "text-emerald-600" },
    { label: "Revenue", value: `${currencySymbol}${(data?.revenue ?? 0).toFixed(0)}`, icon: TrendingUp, color: "text-amber-600" },
    { label: "Sessions", value: data?.sessions ?? 0, icon: Eye, color: "text-blue-600" },
    { label: "Conv.", value: `${(data?.conversion ?? 0).toFixed(1)}%`, icon: ArrowUpRight, color: "text-purple-600" },
  ];

  return (
    <Card className="border shadow-none">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.1em]">Today</p>
          <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
            <Users className="h-3 w-3" /> {data?.visitors ?? 0} unique
          </span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {tiles.map((t) => (
            <div key={t.label} className="text-center">
              <div className={`flex h-9 w-9 mx-auto mb-1.5 items-center justify-center rounded-xl bg-accent/50 ${t.color}`}>
                <t.icon className="h-4 w-4" />
              </div>
              <p className="text-sm font-bold text-foreground tracking-tight tabular-nums truncate">{t.value}</p>
              <p className="text-[10px] font-medium text-muted-foreground leading-tight">{t.label}</p>
            </div>
          ))}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="mt-3 w-full gap-1.5 text-xs h-8 font-semibold"
          onClick={() => navigate(`/dashboard/analytics`)}
        >
          <BarChart3 className="h-3.5 w-3.5" />
          View detailed analytics
        </Button>
      </CardContent>
    </Card>
  );
}
