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

const REVENUE_STATUSES = ["confirmed", "shipped", "delivered", "partially_paid"];

export default function TodayInsights({ storeId, storeSlug, currencySymbol }: Props) {
  const { navigate } = useNavigateTransition();

  const todayStartIso = (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  })();

  const { data } = useQuery({
    queryKey: ["today-insights", storeId, todayStartIso],
    staleTime: 2 * 60 * 1000,
    enabled: !!storeId,
    queryFn: async () => {
      const [ordersRes, viewsRes] = await Promise.all([
        supabase
          .from("orders")
          .select("total")
          .eq("store_id", storeId)
          .gte("created_at", todayStartIso)
          .in("status", REVENUE_STATUSES),
        supabase
          .from("page_views")
          .select("session_id, visitor_id")
          .eq("store_id", storeId)
          .eq("is_bot", false)
          .gte("created_at", todayStartIso),
      ]);

      const orders = ordersRes.data || [];
      const views = viewsRes.data || [];
      const revenue = orders.reduce((s, o) => s + Number(o.total || 0), 0);

      const sessions = new Set(
        views.map((v: any) => v.session_id || v.visitor_id || "anon")
      ).size;
      const visitors = new Set(
        views.map((v: any) => v.visitor_id || v.session_id || "anon")
      ).size;
      const conversion = sessions > 0 ? (orders.length / sessions) * 100 : 0;

      return {
        orders: orders.length,
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
          onClick={() => navigate(`/dashboard/stores/${storeSlug}/analytics`)}
        >
          <BarChart3 className="h-3.5 w-3.5" />
          View detailed analytics
        </Button>
      </CardContent>
    </Card>
  );
}
