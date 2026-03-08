import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { BarChart3, TrendingUp, Package } from "lucide-react";

export default function StoreAnalytics() {
  const { user } = useAuth();

  const { data: stores } = useQuery({
    queryKey: ["stores", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("id, name")
        .eq("owner_id", user!.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const storeIds = stores?.map((s) => s.id) || [];

  const { data: ordersData } = useQuery({
    queryKey: ["store-analytics-orders", storeIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_orders")
        .select("created_at, product_price, quantity, product_name")
        .in("store_id", storeIds)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: storeIds.length > 0,
  });

  // Aggregate orders by month
  const ordersByMonth = (() => {
    if (!ordersData) return [];
    const map: Record<string, { month: string; orders: number; revenue: number }> = {};
    ordersData.forEach((o) => {
      const month = o.created_at.slice(0, 7);
      if (!map[month]) map[month] = { month, orders: 0, revenue: 0 };
      map[month].orders += 1;
      map[month].revenue += Number(o.product_price) * o.quantity;
    });
    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month)).slice(-12);
  })();

  // Top products by order count
  const topProducts = (() => {
    if (!ordersData) return [];
    const map: Record<string, { name: string; count: number; revenue: number }> = {};
    ordersData.forEach((o) => {
      const key = o.product_name;
      if (!map[key]) map[key] = { name: key, count: 0, revenue: 0 };
      map[key].count += o.quantity;
      map[key].revenue += Number(o.product_price) * o.quantity;
    });
    return Object.values(map).sort((a, b) => b.count - a.count).slice(0, 10);
  })();

  const totalRevenue = ordersData?.reduce((sum, o) => sum + Number(o.product_price) * o.quantity, 0) || 0;
  const totalOrders = ordersData?.length || 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-foreground">Analytics</h1>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <BarChart3 className="h-8 w-8 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Total Orders</p>
              <p className="text-2xl font-bold text-foreground">{totalOrders}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <TrendingUp className="h-8 w-8 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Total Revenue</p>
              <p className="text-2xl font-bold text-foreground">${totalRevenue.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <Package className="h-8 w-8 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Top Products</p>
              <p className="text-2xl font-bold text-foreground">{topProducts.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Over Time */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Revenue Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          {ordersByMonth.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={ordersByMonth}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip />
                <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-8 text-center text-muted-foreground">No order data yet</p>
          )}
        </CardContent>
      </Card>

      {/* Orders Over Time */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Orders Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          {ordersByMonth.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={ordersByMonth}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip />
                <Bar dataKey="orders" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-8 text-center text-muted-foreground">No order data yet</p>
          )}
        </CardContent>
      </Card>

      {/* Top Products */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top Products by Orders</CardTitle>
        </CardHeader>
        <CardContent>
          {topProducts.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topProducts} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" className="text-xs" />
                <YAxis dataKey="name" type="category" width={120} className="text-xs" />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-8 text-center text-muted-foreground">No product data yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
