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
      const REVENUE_STATUSES = ["confirmed", "shipped", "delivered", "partially_paid"];
      const [ordersRes, partialRes, customersRes] = await Promise.all([
        supabase
          .from("orders")
          .select("total")
          .eq("store_id", storeId)
          .gte("created_at", iso)
          .in("status", REVENUE_STATUSES),
        supabase
          .from("orders")
          .select("total")
          .eq("store_id", storeId)
          .gte("created_at", iso)
          .eq("status", "pending")
          .gt("advance_paid", 0),
        supabase
          .from("customers")
          .select("id", { count: "exact", head: true })
          .eq("store_id", storeId)
          .gte("created_at", iso),
      ]);
      const orders = [...(ordersRes.data || []), ...(partialRes.data || [])];
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
    <Card className="border shadow-none hover:shadow-md transition-shadow duration-200">
      <CardContent className="p-4">
        <p className="mb-3 text-[11px] font-bold text-muted-foreground uppercase tracking-[0.1em]">Today</p>
        <div className="grid grid-cols-3 gap-3">
          {items.map((item) => (
            <div key={item.label} className="text-center">
              <div className={`flex h-9 w-9 mx-auto mb-1.5 items-center justify-center rounded-xl bg-accent/50 ${item.color}`}>
                <item.icon className="h-4 w-4" />
              </div>
              <p className="text-base font-bold text-foreground tracking-tight">{item.value}</p>
              <p className="text-[10px] font-medium text-muted-foreground leading-tight">{item.label}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
