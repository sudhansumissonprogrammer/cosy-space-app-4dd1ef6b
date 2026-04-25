import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useDashboardStore } from "@/contexts/DashboardStoreContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Package, ShoppingBag, Eye, TrendingUp, HelpCircle, Plus, Copy, Check, Share2 } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line,
} from "recharts";
import OnboardingWalkthrough from "@/components/OnboardingWalkthrough";
import { useNavigateTransition } from "@/hooks/useNavigateTransition";
import QuickActions from "@/components/dashboard/QuickActions";
import HeroRevenue from "@/components/dashboard/HeroRevenue";
import PendingActions from "@/components/dashboard/PendingActions";
import RecentOrders from "@/components/dashboard/RecentOrders";
import TopProducts from "@/components/dashboard/TopProducts";
import StoreChecklist from "@/components/dashboard/StoreChecklist";
import QueryErrorState from "@/components/QueryErrorState";
import ShareStoreDialog from "@/components/ShareStoreDialog";
import { useCountUp } from "@/hooks/useCountUp";

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
      <ShimmerBlock className="h-24 w-full rounded-2xl" />
      <div className="flex gap-2.5 overflow-hidden">
        {[1, 2, 3, 4].map((i) => (
          <ShimmerBlock key={i} className="h-16 w-32 shrink-0 rounded-lg" />
        ))}
      </div>
      <ShimmerBlock className="h-[180px] w-full" />
    </div>
  );
}

function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(" ");
}

function AnimatedStatValue({ value }: { value: number | string }) {
  const numericValue = typeof value === "string" ? parseFloat(value.replace(/[^0-9.]/g, "")) || 0 : value;
  const prefix = typeof value === "string" ? value.replace(/[0-9.,]/g, "") : "";
  const animated = useCountUp(numericValue);
  return <>{prefix}{animated.toLocaleString()}</>;
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

  // Live store status — single check, no polling
  const storeUrl = customDomain
    ? `https://${customDomain}`
    : storeSlug ? `https://${storeSlug}.shopbanao.in` : null;

  // Instead of polling HEAD requests every 60s (which hammers the Worker),
  // just assume the store is live if a slug exists. The store is served by
  // the Worker and is always reachable once published.
  const isStoreLive = !!storeUrl;

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

  if (storeLoading) return <DashboardSkeleton />;

  if (storeError) {
    return <QueryErrorState message="Failed to load your store" onRetry={() => refetchStore()} />;
  }

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
        <div className="flex items-center gap-2">
          {store?.slug && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs h-8 font-semibold"
              asChild
            >
              <a href={storeUrl!} target="_blank" rel="noopener noreferrer">
                <Eye className="h-3 w-3" /> View Store
              </a>
            </Button>
          )}
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
      </div>

      {/* 🔥 Hero Revenue — THE biggest number at the top */}
      {storeId && !isWhatsAppOnly && (
        <HeroRevenue storeId={storeId} currencySymbol={currencySymbol} />
      )}

      {/* Store URL — compact strip */}
      {store?.slug && (
        <div className="flex items-center gap-2 rounded-xl border bg-accent/20 px-3 py-2">
          {isStoreLive !== undefined && (
            <span className={cn(
              "h-2 w-2 rounded-full shrink-0",
              isStoreLive ? "bg-emerald-500 animate-pulse" : "bg-red-500"
            )} />
          )}
          <p className="text-xs font-medium text-foreground truncate flex-1">
            {customDomain || `${store.slug}.shopbanao.in`}
          </p>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleCopy} title="Copy link">
            {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
          </Button>
        </div>
      )}

      {/* Quick Actions */}
      {storeId && (
        <QuickActions storeId={storeId} storeSlug={store?.slug || ""} storeName={store?.name} isWhatsAppOnly={isWhatsAppOnly} />
      )}

      {isLoading ? (
        <DashboardSkeleton />
      ) : (
        <>
          {/* Stat cards — horizontal scrollable on mobile, grid on desktop */}
          <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-hide md:grid md:grid-cols-3 md:overflow-visible">
            {statCards.map((card) => (
              <Card key={card.label} className="border shadow-none hover:shadow-md transition-shadow duration-200 shrink-0 min-w-[120px] md:min-w-0">
                <CardContent className="flex items-center gap-2.5 p-3">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/50 ${card.color}`}>
                    <card.icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{card.label}</p>
                    <p className="text-base font-bold text-foreground truncate tracking-tight tabular-nums">
                      <AnimatedStatValue value={card.value} />
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Store Checklist — promoted above Pending Actions so new owners see setup tasks first */}
          {storeId && <StoreChecklist storeId={storeId} storeSlug={store?.slug || ""} />}

          {/* Pending Actions */}
          {storeId && !isWhatsAppOnly && <PendingActions storeId={storeId} storeSlug={store?.slug || ""} />}

          {/* Recent Orders */}
          {storeId && !isWhatsAppOnly && (
            <RecentOrders
              storeId={storeId}
              storeSlug={store?.slug || ""}
              currencySymbol={currencySymbol}
              whatsappNumber={store?.whatsapp_number || ""}
              storeName={store?.name || ""}
            />
          )}

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
                  <div className="flex flex-col items-center gap-2 py-8">
                    <p className="text-xs text-muted-foreground">No revenue data yet</p>
                    {store?.slug && store?.name && (
                      <ShareStoreDialog
                        storeSlug={store.slug}
                        storeName={store.name}
                        trigger={
                          <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8">
                            <Share2 className="h-3 w-3" />
                            Share your store to get started
                          </Button>
                        }
                      />
                    )}
                  </div>
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
                  <div className="flex flex-col items-center gap-2 py-8">
                    <p className="text-xs text-muted-foreground">No orders yet</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs h-8"
                      onClick={() => navigate(`/dashboard/stores/${storeSlug}/products/create`)}
                    >
                      <Plus className="h-3 w-3" />
                      Add your first product
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
