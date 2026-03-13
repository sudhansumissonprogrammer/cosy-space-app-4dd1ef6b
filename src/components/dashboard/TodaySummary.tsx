import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { ShoppingBag, TrendingUp, Users } from "lucide-react";

interface TodaySummaryProps {
  storeId: string;
  currencySymbol: string;
}

export default function TodaySummary({ storeId, currencySymbol }: TodaySummaryProps) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data } = useQuery({
    queryKey: ["today-summary", storeId],
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const iso = todayStart.toISOString();
      const [ordersRes, customersRes] = await Promise.all([
        supabase
          .from("orders")
          .select("total")
          .eq("store_id", storeId)
          .gte("created_at", iso)
          .neq("status", "cancelled"),
        supabase
          .from("customers")
          .select("id", { count: "exact", head: true })
          .eq("store_id", storeId)
          .gte("created_at", iso),
      ]);
      const orders = ordersRes.data || [];
      const revenue = orders.reduce((sum, o) => sum + Number(o.total || 0), 0);
      return {
        orders: orders.length,
        revenue,
        customers: customersRes.count ?? 0,
      };
    },
    enabled: !!storeId,
  });

  const items = [
    { label: "Today's Orders", value: data?.orders ?? 0, icon: ShoppingBag, color: "text-emerald-600" },
    { label: "Today's Revenue", value: `${currencySymbol}${(data?.revenue ?? 0).toFixed(0)}`, icon: TrendingUp, color: "text-amber-600" },
    { label: "New Customers", value: data?.customers ?? 0, icon: Users, color: "text-blue-600" },
  ];

  return (
    <Card className="border shadow-none">
      <CardContent className="p-3">
        <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">Today</p>
        <div className="grid grid-cols-3 gap-2">
          {items.map((item) => (
            <div key={item.label} className="text-center">
              <item.icon className={`h-4 w-4 mx-auto mb-1 ${item.color}`} />
              <p className="text-sm font-bold text-foreground">{item.value}</p>
              <p className="text-[10px] text-muted-foreground leading-tight">{item.label}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
