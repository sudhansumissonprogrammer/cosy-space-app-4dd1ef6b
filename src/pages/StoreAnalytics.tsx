import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { BarChart3, TrendingUp, Package, AlertTriangle, ImageOff, CheckCircle2 } from "lucide-react";

export default function StoreAnalytics() {
  const { user } = useAuth();

  const { data: stores } = useQuery({
    queryKey: ["stores", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("id, name, currency")
        .eq("owner_id", user!.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const storeIds = stores?.map((s) => s.id) || [];
  const currency = stores?.[0]?.currency || "USD";
  const currencySymbol = currency === "INR" ? "₹" : currency === "USD" ? "$" : currency;

  const { data: ordersData } = useQuery({
    queryKey: ["store-analytics-orders", storeIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("created_at, total, status, order_items(product_name, quantity, total)")
        .in("store_id", storeIds)
        .neq("status", "cancelled")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
    enabled: storeIds.length > 0,
  });

  // Store Health: products missing images / unoptimized
  const { data: healthData } = useQuery({
    queryKey: ["store-health", storeIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, image_url, name")
        .in("store_id", storeIds);
      if (error) throw error;
      const total = data?.length || 0;
      const noImage = data?.filter((p) => !p.image_url).length || 0;
      const unoptimized = data?.filter((p) => p.image_url && !p.image_url.includes("width=") && !p.image_url.includes("w=")).length || 0;
      return { total, noImage, unoptimized, optimized: total - noImage - unoptimized };
    },
    enabled: storeIds.length > 0,
  });

  const ordersByMonth = (() => {
    if (!ordersData) return [];
    const map: Record<string, { month: string; orders: number; revenue: number }> = {};
    ordersData.forEach((o: any) => {
      const month = o.created_at.slice(0, 7);
      if (!map[month]) map[month] = { month, orders: 0, revenue: 0 };
      map[month].orders += 1;
      map[month].revenue += Number(o.total || 0);
    });
    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month)).slice(-12);
  })();

  const topProducts = (() => {
    if (!ordersData) return [];
    const map: Record<string, { name: string; count: number; revenue: number }> = {};
    ordersData.forEach((o: any) => {
      o.order_items?.forEach((item: any) => {
        const key = item.product_name;
        if (!map[key]) map[key] = { name: key, count: 0, revenue: 0 };
        map[key].count += item.quantity || 1;
        map[key].revenue += Number(item.total || 0);
      });
    });
    return Object.values(map).sort((a, b) => b.count - a.count).slice(0, 10);
  })();

  const totalRevenue = ordersData?.reduce((sum: number, o: any) => sum + Number(o.total || 0), 0) || 0;
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
              <p className="text-2xl font-bold text-foreground">{currencySymbol}{totalRevenue.toFixed(2)}</p>
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

      {/* Store Health Dashboard */}
      {healthData && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Store Health</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="flex items-center gap-3 rounded-lg border border-border p-3">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">Total Products</p>
                  <p className="text-lg font-bold text-foreground">{healthData.total}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border border-border p-3">
                <ImageOff className="h-5 w-5 text-destructive" />
                <div>
                  <p className="text-xs text-muted-foreground">Missing Images</p>
                  <p className="text-lg font-bold text-foreground">{healthData.noImage}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border border-border p-3">
                <AlertTriangle className="h-5 w-5 text-warning" />
                <div>
                  <p className="text-xs text-muted-foreground">Unoptimized Images</p>
                  <p className="text-lg font-bold text-foreground">{healthData.unoptimized}</p>
                </div>
              </div>
            </div>
            {(healthData.noImage > 0 || healthData.unoptimized > 0) && (
              <div className="mt-3 rounded-lg bg-warning/10 border border-warning/20 p-3">
                <p className="text-xs font-medium text-foreground">
                  ⚠️ {healthData.noImage > 0 ? `${healthData.noImage} products have no image. ` : ""}
                  {healthData.unoptimized > 0 ? `${healthData.unoptimized} products use unoptimized images — slowing page load.` : ""}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
