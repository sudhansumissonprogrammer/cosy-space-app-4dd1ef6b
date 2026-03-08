import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, ShoppingBag, Users, Eye } from "lucide-react";

export default function Dashboard() {
  const { user } = useAuth();

  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats", user?.id],
    queryFn: async () => {
      const storesRes = await supabase.from("stores").select("id").eq("owner_id", user!.id);
      const storeIds = storesRes.data?.map(s => s.id) || [];

      const [productsRes, ordersRes, customersRes, viewsRes] = await Promise.all([
        supabase
          .from("products")
          .select("id", { count: "exact", head: true })
          .in("store_id", storeIds),
        supabase
          .from("whatsapp_orders")
          .select("id", { count: "exact", head: true })
          .in("store_id", storeIds),
        supabase
          .from("customers")
          .select("id", { count: "exact", head: true })
          .in("store_id", storeIds),
        storeIds.length > 0
          ? supabase.rpc("get_store_views", { _store_ids: storeIds })
          : Promise.resolve({ data: [] }),
      ]);

      const totalViews = (viewsRes.data as any[])?.reduce(
        (sum: number, r: any) => sum + Number(r.view_count || 0), 0
      ) || 0;

      return {
        total_products: productsRes.count ?? 0,
        total_orders: ordersRes.count ?? 0,
        total_customers: customersRes.count ?? 0,
        total_views: totalViews,
      };
    },
    enabled: !!user,
  });

  const cards = [
    { title: "Total Products", value: stats?.total_products ?? 0, icon: Package },
    { title: "Total Orders", value: stats?.total_orders ?? 0, icon: ShoppingBag },
    { title: "Total Customers", value: stats?.total_customers ?? 0, icon: Users },
    { title: "Store Views", value: stats?.total_views ?? 0, icon: Eye },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Your store overview at a glance.</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((card) => (
            <Card key={card.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
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
