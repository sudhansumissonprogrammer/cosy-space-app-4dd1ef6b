import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Store, ShoppingBag, Ban, Package, DollarSign, UserX, UserPlus, ShoppingCart, ArrowRight } from "lucide-react";
import { StatCardsSkeleton } from "@/components/admin/AdminSkeletons";
import QueryErrorState from "@/components/QueryErrorState";
import { format } from "date-fns";
import { useDocumentTitle, currencySymbol } from "@/hooks/useDocumentTitle";

interface AdminStats {
  total_users: number;
  total_stores: number;
  total_products: number;
  total_orders: number;
  total_revenue: number;
  suspended_stores: number;
  blocked_users: number;
  recent_signups: { email: string; created_at: string }[];
  recent_orders: { product_name: string; product_price: number; quantity: number; created_at: string; store_name: string }[];
}

export default function AdminOverview() {
  useDocumentTitle("Overview · Admin");

  const { data: platformConfig } = useQuery({
    queryKey: ["platform-config-currency"],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("platform_config")
        .select("default_currency")
        .limit(1)
        .single();
      return data as { default_currency: string } | null;
    },
  });
  const cur = currencySymbol(platformConfig?.default_currency);

  const { data: stats, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-stats"],
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_admin_stats");
      if (error) throw error;
      return data as unknown as AdminStats;
    },
  });

  const cards = [
    { title: "Total Users", value: stats?.total_users ?? 0, icon: Users },
    { title: "Total Stores", value: stats?.total_stores ?? 0, icon: Store },
    { title: "Total Products", value: stats?.total_products ?? 0, icon: Package },
    { title: "Total Orders", value: stats?.total_orders ?? 0, icon: ShoppingBag },
    { title: "Total Revenue", value: `${cur}${Number(stats?.total_revenue ?? 0).toFixed(2)}`, icon: DollarSign },
    { title: "Suspended Stores", value: stats?.suspended_stores ?? 0, icon: Ban },
    { title: "Blocked Users", value: stats?.blocked_users ?? 0, icon: UserX },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-foreground">Overview</h1>

      {isError ? (
        <QueryErrorState message="Failed to load admin stats" onRetry={() => refetch()} />
      ) : isLoading ? (
        <StatCardsSkeleton />
      ) : (
        <>
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

          {/* Recent Activity */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Recent Signups */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div className="flex items-center gap-2">
                  <UserPlus className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-sm font-medium">Recent Signups</CardTitle>
                </div>
                <Link
                  to="/admin/users-stores"
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  View all <ArrowRight className="h-3 w-3" />
                </Link>
              </CardHeader>
              <CardContent className="space-y-3">
                {stats?.recent_signups?.length ? (
                  stats.recent_signups.map((s, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="truncate text-foreground">{s.email}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {format(new Date(s.created_at), "MMM d, HH:mm")}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No signups yet</p>
                )}
              </CardContent>
            </Card>

            {/* Recent Orders */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-sm font-medium">Recent Orders</CardTitle>
                </div>
                <Link
                  to="/admin/orders"
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  View all <ArrowRight className="h-3 w-3" />
                </Link>
              </CardHeader>
              <CardContent className="space-y-3">
                {stats?.recent_orders?.length ? (
                  stats.recent_orders.map((o, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <div className="truncate">
                        <span className="text-foreground">{o.product_name}</span>
                        <span className="ml-1 text-xs text-muted-foreground">× {o.quantity}</span>
                        <span className="ml-2 text-xs text-muted-foreground">{o.store_name}</span>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        ₹{(o.product_price * o.quantity).toFixed(0)}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No orders yet</p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
