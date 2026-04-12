import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useDashboardStore } from "@/contexts/DashboardStoreContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Package, ShoppingBag, Eye, TrendingUp, HelpCircle, Plus, Copy, Check } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line,
} from "recharts";
import OnboardingWalkthrough from "@/components/OnboardingWalkthrough";
import { useNavigateTransition } from "@/hooks/useNavigateTransition";
import QuickActions from "@/components/dashboard/QuickActions";
import TodaySummary from "@/components/dashboard/TodaySummary";
import PendingActions from "@/components/dashboard/PendingActions";
import RecentOrders from "@/components/dashboard/RecentOrders";
import TopProducts from "@/components/dashboard/TopProducts";
import StoreChecklist from "@/components/dashboard/StoreChecklist";
import QueryErrorState from "@/components/QueryErrorState";

function ShimmerBlock({ className }: { className?: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-lg bg-muted", className)}>
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2.5">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-lg border p-3 flex items-center gap-3">
            <ShimmerBlock className="h-5 w-5 rounded-md" />
            <div className="flex-1 space-y-1.5">
              <ShimmerBlock className="h-3 w-12" />
              <ShimmerBlock className="h-5 w-16" />
            </div>
          </div>
        ))}
      </div>
      <ShimmerBlock className="h-20 w-full" />
      <ShimmerBlock className="h-[180px] w-full" />
    </div>
  );
}

function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(" ");
}

export default function Dashboard() {
  const { user } = useAuth();
  const { navigate } = useNavigateTransition();

  const { store, storeId, storeSlug, isLoading: storeLoading } = useDashboardStore();
  const storeError = false;
  const refetchStore = () => {};

  const customDomain = store?.custom_domain;
  const isWhatsAppOnly = store?.order_mode === "whatsapp";
  const currency = store?.currency || "USD";
  const currencySymbol = currency === "INR" ? "₹" : currency === "USD" ? "$" : currency;

  // Live store status check
  const storeUrl = customDomain
    ? `https://${customDomain}`
    : storeSlug ? `https://${storeSlug}.shopbanao.in` : null;

  const { data: isStoreLive } = useQuery({
    queryKey: ["store-live-status", storeUrl],
    queryFn: async () => {
      if (!storeUrl) return false;
      try {
        const res = await fetch(storeUrl, { method: "HEAD", mode: "no-cors", cache: "no-store" });
        return true; // no-cors always returns opaque response, if no error = reachable
      } catch {
        return false;
      }
    },
    enabled: !!storeUrl,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    if (!storeUrl) return;
    navigator.clipboard.writeText(storeUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [storeUrl]);

  const [showOnboarding, setShowOnboarding] = useState(false);
  useEffect(() => {
    if (storeId && !localStorage.getItem(`onboarding-done-${storeId}`)) {
      const timer = setTimeout(() => setShowOnboarding(true), 800);
      return () => clearTimeout(timer);
    }
  }, [storeId]);

  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats", storeId],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const [productsRes, ordersRes, customersRes, viewsRes] = await Promise.all([
        supabase.from("products").select("id", { count: "exact", head: true }).eq("store_id", storeId!),
        supabase.from("orders").select("id", { count: "exact", head: true }).eq("store_id", storeId!),
        supabase.from("customers").select("id", { count: "exact", head: true }).eq("store_id", storeId!),
        supabase.rpc("get_store_views", { _store_ids: [storeId!] }),
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
    enabled: !!storeId,
  });

  const { data: ordersData } = useQuery({
    queryKey: ["dashboard-orders-analytics", storeId],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("created_at, total, status, order_items(product_name, quantity, total)")
        .eq("store_id", storeId!)
        .neq("status", "cancelled")
        .order("created_at", { ascending: true })
        .limit(200);
      if (error) throw error;
      return data as any[];
    },
    enabled: !!storeId && !isWhatsAppOnly,
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

  const totalRevenue = ordersData?.reduce((sum: number, o: any) => sum + Number(o.total || 0), 0) || 0;

  // Show skeleton while store query is loading
  if (storeLoading) {
    return <DashboardSkeleton />;
  }

  // Error loading store
  if (storeError) {
    return (
      <QueryErrorState message="Failed to load your store" onRetry={() => refetchStore()} />
    );
  }

  // No store yet — show create CTA
  if (!storeId) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <Plus className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">Create Your Store</h2>
        <p className="max-w-xs text-sm text-muted-foreground">
          Set up your online store in minutes. Add products, customize your theme, and start selling.
        </p>
        <Button onClick={() => navigate("/dashboard/stores/create")} className="mt-2">
          Create Store
        </Button>
      </div>
    );
  }

  const statCards = [
    { label: "Products", value: stats?.total_products ?? 0, icon: Package, color: "text-blue-600" },
    ...(!isWhatsAppOnly ? [
      { label: "Orders", value: stats?.total_orders ?? 0, icon: ShoppingBag, color: "text-emerald-600" },
      { label: "Revenue", value: `${currencySymbol}${totalRevenue.toFixed(0)}`, icon: TrendingUp, color: "text-amber-600" },
    ] : []),
    { label: "Views", value: stats?.total_views ?? 0, icon: Eye, color: "text-purple-600" },
  ];

  return (
    <div className="space-y-4">
      {storeId && (
        <OnboardingWalkthrough
          storeId={storeId}
          storeSlug={store?.slug || ""}
          open={showOnboarding}
          onOpenChange={setShowOnboarding}
        />
      )}

      {/* Greeting + guide */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight text-foreground">Overview</h1>
        {storeId && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowOnboarding(true)}
            className="gap-1 text-xs h-8"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            Guide
          </Button>
        )}
      </div>

      {/* Store URL */}
      {store?.slug && (
        <Card className="border shadow-none bg-gradient-to-r from-accent/30 to-accent/10">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Eye className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Your Store</p>
                {isStoreLive !== undefined && (
                  <span className={cn(
                    "inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full",
                    isStoreLive
                      ? "text-emerald-700 bg-emerald-100"
                      : "text-red-700 bg-red-100"
                  )}>
                    <span className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      isStoreLive ? "bg-emerald-500 animate-pulse" : "bg-red-500"
                    )} />
                    {isStoreLive ? "Live" : "Offline"}
                  </span>
                )}
              </div>
              <p className="text-sm font-semibold text-foreground truncate tracking-tight">
                {customDomain || `${store.slug}.shopbanao.in`}
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={handleCopy}
                title="Copy link"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8 font-semibold" asChild>
                <a href={storeUrl!} target="_blank" rel="noopener noreferrer">
                  <Eye className="h-3 w-3" /> View
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      {storeId && (
        <QuickActions storeId={storeId} storeSlug={store?.slug || ""} storeName={store?.name} isWhatsAppOnly={isWhatsAppOnly} />
      )}

      {isLoading ? (
        <DashboardSkeleton />
      ) : (
        <>
          {/* Stat cards — 2x2 grid on mobile */}
          <div className="grid grid-cols-2 gap-3">
            {statCards.map((card) => (
              <Card key={card.label} className="border shadow-none hover:shadow-md transition-shadow duration-200 group">
                <CardContent className="flex items-center gap-3 p-4">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/50 ${card.color} group-hover:scale-105 transition-transform`}>
                    <card.icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{card.label}</p>
                    <p className="text-lg font-bold text-foreground truncate tracking-tight">{card.value}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Today's Summary */}
          {storeId && !isWhatsAppOnly && <TodaySummary storeId={storeId} currencySymbol={currencySymbol} />}

          {/* Pending Actions */}
          {storeId && !isWhatsAppOnly && <PendingActions storeId={storeId} storeSlug={store?.slug || ""} />}

          {/* Store Checklist */}
          {storeId && <StoreChecklist storeId={storeId} storeSlug={store?.slug || ""} />}

          {/* Recent Orders */}
          {storeId && !isWhatsAppOnly && <RecentOrders storeId={storeId} storeSlug={store?.slug || ""} currencySymbol={currencySymbol} />}

          {/* Top Products */}
          {storeId && !isWhatsAppOnly && <TopProducts storeId={storeId} currencySymbol={currencySymbol} />}

          {/* Revenue chart */}
          {!isWhatsAppOnly && (
            <Card className="border shadow-none">
              <CardContent className="p-3 pt-4">
                <p className="mb-3 text-sm font-bold tracking-tight text-foreground">Revenue</p>
                {ordersByMonth.length > 0 ? (
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={ordersByMonth}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="month" className="text-[10px]" tick={{ fontSize: 10 }} />
                      <YAxis className="text-[10px]" tick={{ fontSize: 10 }} width={40} />
                      <Tooltip
                        contentStyle={{ fontSize: 12 }}
                        formatter={(value: number) => `${currencySymbol}${value.toFixed(0)}`}
                      />
                      <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="py-6 text-center text-xs text-muted-foreground">No data yet</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Orders chart */}
          {!isWhatsAppOnly && (
            <Card className="border shadow-none">
              <CardContent className="p-3 pt-4">
                <p className="mb-3 text-sm font-bold tracking-tight text-foreground">Orders</p>
                {ordersByMonth.length > 0 ? (
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={ordersByMonth}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="month" className="text-[10px]" tick={{ fontSize: 10 }} />
                      <YAxis className="text-[10px]" tick={{ fontSize: 10 }} width={30} />
                      <Tooltip contentStyle={{ fontSize: 12 }} />
                      <Bar dataKey="orders" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="py-6 text-center text-xs text-muted-foreground">No data yet</p>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
