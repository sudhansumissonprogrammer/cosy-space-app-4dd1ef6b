import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, ShoppingBag, Users, Eye, TrendingUp } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line,
} from "recharts";

export default function Dashboard() {
  const { user } = useAuth();

  const { data: stores } = useQuery({
    queryKey: ["my-stores", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("id, currency")
        .eq("owner_id", user!.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const ids = stores?.map((s) => s.id) || [];
  const currency = stores?.[0]?.currency || "USD";
  const currencySymbol = currency === "INR" ? "₹" : currency === "USD" ? "$" : currency;

  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats", ids],
    queryFn: async () => {
      const [productsRes, webOrdersRes, whatsappOrdersRes, customersRes, viewsRes] = await Promise.all([
        supabase.from("products").select("id", { count: "exact", head: true }).in("store_id", ids),
        supabase.from("orders").select("id", { count: "exact", head: true }).in("store_id", ids),
        supabase.from("whatsapp_orders").select("id", { count: "exact", head: true }).in("store_id", ids),
        supabase.from("customers").select("id", { count: "exact", head: true }).in("store_id", ids),
        ids.length > 0
          ? supabase.rpc("get_store_views", { _store_ids: ids })
          : Promise.resolve({ data: [] }),
      ]);

      const totalViews = (viewsRes.data as any[])?.reduce(
        (sum: number, r: any) => sum + Number(r.view_count || 0), 0
      ) || 0;

      return {
        total_products: productsRes.count ?? 0,
        total_orders: (webOrdersRes.count ?? 0) + (whatsappOrdersRes.count ?? 0),
        total_customers: customersRes.count ?? 0,
        total_views: totalViews,
      };
    },
    enabled: ids.length > 0,
  });

  // Fetch website orders for analytics
  const { data: webOrdersData } = useQuery({
    queryKey: ["dashboard-web-orders-analytics", ids],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("created_at, total, status, order_items(product_name, quantity, total)")
        .in("store_id", ids)
        .neq("status", "cancelled")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
    enabled: ids.length > 0,
  });

  // Fetch whatsapp orders for analytics
  const { data: whatsappOrdersData } = useQuery({
    queryKey: ["dashboard-whatsapp-orders-analytics", ids],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_orders")
        .select("created_at, product_price, quantity, product_name, status")
        .in("store_id", ids)
        .neq("status", "cancelled")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: ids.length > 0,
  });

  // Merge both order sources into monthly aggregates
  const ordersByMonth = (() => {
    const map: Record<string, { month: string; orders: number; revenue: number }> = {};

    // Website orders
    webOrdersData?.forEach((o: any) => {
      const month = o.created_at.slice(0, 7);
      if (!map[month]) map[month] = { month, orders: 0, revenue: 0 };
      map[month].orders += 1;
      map[month].revenue += Number(o.total || 0);
    });

    // WhatsApp orders
    whatsappOrdersData?.forEach((o) => {
      const month = o.created_at.slice(0, 7);
      if (!map[month]) map[month] = { month, orders: 0, revenue: 0 };
      map[month].orders += 1;
      map[month].revenue += Number(o.product_price) * o.quantity;
    });

    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month)).slice(-12);
  })();

  // Top products from both sources
  const topProducts = (() => {
    const map: Record<string, { name: string; count: number; revenue: number }> = {};

    // Website order items
    webOrdersData?.forEach((o: any) => {
      o.order_items?.forEach((item: any) => {
        const key = item.product_name;
        if (!map[key]) map[key] = { name: key, count: 0, revenue: 0 };
        map[key].count += item.quantity || 1;
        map[key].revenue += Number(item.total || 0);
      });
    });

    // WhatsApp orders
    whatsappOrdersData?.forEach((o) => {
      const key = o.product_name;
      if (!map[key]) map[key] = { name: key, count: 0, revenue: 0 };
      map[key].count += o.quantity;
      map[key].revenue += Number(o.product_price) * o.quantity;
    });

    return Object.values(map).sort((a, b) => b.count - a.count).slice(0, 10);
  })();

  const totalRevenue =
    (webOrdersData?.reduce((sum: number, o: any) => sum + Number(o.total || 0), 0) || 0) +
    (whatsappOrdersData?.reduce((sum, o) => sum + Number(o.product_price) * o.quantity, 0) || 0);

  const cards = [
    { title: "Total Products", value: stats?.total_products ?? 0, icon: Package },
    { title: "Total Orders", value: stats?.total_orders ?? 0, icon: ShoppingBag },
    { title: "Revenue", value: `${currencySymbol}${totalRevenue.toFixed(2)}`, icon: TrendingUp },
    { title: "Customers", value: stats?.total_customers ?? 0, icon: Users },
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
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
                    <Tooltip formatter={(value: number) => `${currencySymbol}${value.toFixed(2)}`} />
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
        </>
      )}
    </div>
  );
}
