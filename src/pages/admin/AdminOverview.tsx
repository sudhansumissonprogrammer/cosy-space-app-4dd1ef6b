import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Store, ShoppingBag, Ban, Package, DollarSign, UserX } from "lucide-react";
import { StatCardsSkeleton } from "@/components/admin/AdminSkeletons";

export default function AdminOverview() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin-stats"],
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_admin_stats");
      if (error) throw error;
      return data as {
        total_users: number;
        total_stores: number;
        total_products: number;
        total_orders: number;
        total_revenue: number;
        suspended_stores: number;
        blocked_users: number;
      };
    },
  });

  const cards = [
    { title: "Total Users", value: stats?.total_users ?? 0, icon: Users },
    { title: "Total Stores", value: stats?.total_stores ?? 0, icon: Store },
    { title: "Total Products", value: stats?.total_products ?? 0, icon: Package },
    { title: "Total Orders", value: stats?.total_orders ?? 0, icon: ShoppingBag },
    { title: "Total Revenue", value: `$${Number(stats?.total_revenue ?? 0).toFixed(2)}`, icon: DollarSign },
    { title: "Suspended Stores", value: stats?.suspended_stores ?? 0, icon: Ban },
    { title: "Blocked Users", value: stats?.blocked_users ?? 0, icon: UserX },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-foreground">Overview</h1>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((card) => (
            <Card key={card.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {card.title}
                </CardTitle>
                <card.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">{card.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
