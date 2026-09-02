import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useDashboardStore } from "@/contexts/DashboardStoreContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Package, Eye, HelpCircle, Plus, Copy, Check, Share2 } from "lucide-react";
import OnboardingWalkthrough from "@/components/OnboardingWalkthrough";
import { useNavigateTransition } from "@/hooks/useNavigateTransition";
import HeroRevenue from "@/components/dashboard/HeroRevenue";
import TodayInsights from "@/components/dashboard/TodayInsights";
import LiveVisitors from "@/components/dashboard/LiveVisitors";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import PendingActions from "@/components/dashboard/PendingActions";
import StoreChecklist from "@/components/dashboard/StoreChecklist";
import QueryErrorState from "@/components/QueryErrorState";
import ShareStoreDialog from "@/components/ShareStoreDialog";
import WalletAccountCard from "@/components/billing/WalletAccountCard";

import { cn } from "@/lib/utils";
import { useCountUp } from "@/hooks/useCountUp";
import { useRealtimeStore } from "@/hooks/useRealtimeStore";
import { endOfMonth, startOfMonth, subMonths } from "date-fns";

// Below-the-fold widgets — kept out of the Overview entry chunk.
const RecentOrders = lazy(() => import("@/components/dashboard/RecentOrders"));
const TopProducts = lazy(() => import("@/components/dashboard/TopProducts"));
const OverviewChart = lazy(() => import("@/components/dashboard/OverviewChart"));



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
      <div className="grid grid-cols-2 gap-2.5">
        {[1, 2].map((i) => (
          <ShimmerBlock key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
      <ShimmerBlock className="h-[280px] w-full rounded-xl" />
      <ShimmerBlock className="h-32 w-full rounded-xl" />
      <ShimmerBlock className="h-40 w-full rounded-xl" />
    </div>
  );
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

  // Realtime: instantly refresh revenue, orders list, today counters, stock changes
  useRealtimeStore(storeId, "dashboard");

  const customDomain = store?.custom_domain;
  const isWhatsAppOnly = false;
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

  // One shared query — PendingActions and StoreChecklist read the same cache
  // entry instead of firing their own counts/config reads.
  const { data: stats, isLoading } = useDashboardStats(storeId);


  const { data: ordersByMonth = [] } = useQuery({
    queryKey: ["dashboard-monthly-sales-exact", storeId],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      // One RPC for all 12 months (was: 12 separate get_store_sales_analytics calls).
      const { data, error } = await supabase.rpc("get_store_monthly_sales", {
        _store_id: storeId!,
        _months: 12,
      });
      if (error) throw error;
      return ((data || []) as Array<{ month: string; orders: number | string; revenue: number | string }>)
        .map((m) => ({
          month: m.month,
          orders: Number(m.orders ?? 0),
          revenue: Number(m.revenue ?? 0),
        }))
        .filter((m) => m.orders > 0 || m.revenue > 0);
    },
    enabled: !!storeId && !isWhatsAppOnly,
  });


  const { data: walletSummary } = useQuery({
    queryKey: ["store-wallet", storeId],
    enabled: !!storeId,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_store_wallet_summary", { _store_id: storeId! });
      if (error) throw error;
      return data as any;
    },
  });

  const isCommissionMode = (store as any)?.billing_mode === "commission" || (walletSummary as any)?.billing_mode === "commission";

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

  // Orders / revenue live in the chart + Recent Orders below, so they are not
  // repeated as stat cards here.
  const statCards = [
    { label: "Products", value: stats?.total_products ?? 0, icon: Package },
    { label: "Views", value: stats?.total_views ?? 0, icon: Eye },
  ];


  return (
    <div className="space-y-4">
      {/* LowBalanceDialog now rendered by DashboardLayout so it locks every page (except /wallet) */}
      {storeId && (
        <OnboardingWalkthrough
          storeId={storeId}
          storeSlug={store?.slug || ""}
          open={showOnboarding}
          onOpenChange={setShowOnboarding}
        />
      )}

      {/* Header — page title + the only primary actions on this page */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold tracking-tight text-foreground">Overview</h1>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="gap-1.5 text-xs h-9 font-semibold"
            onClick={() => navigate(`/dashboard/stores/${storeSlug}/products/create`)}
          >
            <Plus className="h-3.5 w-3.5" /> Add product
          </Button>
          {store?.slug && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs h-9 font-semibold"
              asChild
            >
              <a href={storeUrl!} target="_blank" rel="noopener noreferrer">
                <Eye className="h-3.5 w-3.5" /> View store
              </a>
            </Button>
          )}
          {storeId && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowOnboarding(true)}
              className="gap-1 text-xs h-9"
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

      {/* Live visitors — unique sessions active in last 5 min, realtime */}
      {storeId && !isWhatsAppOnly && (
        <LiveVisitors storeId={storeId} />
      )}

      {/* Today Insights — sessions, conversion, unique visitors + CTA to detailed analytics */}
      {storeId && !isWhatsAppOnly && (
        <TodayInsights storeId={storeId} storeSlug={store?.slug || ""} currencySymbol={currencySymbol} />
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
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0"
            onClick={handleCopy}
            aria-label={copied ? "Store link copied" : "Copy store link"}
            title="Copy link"
          >
            {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
          </Button>
        </div>
      )}

      {/* Wallet card — commission-mode stores only */}
      {storeId && isCommissionMode && (
        <WalletAccountCard storeId={storeId} storeSlug={store?.slug} variant="compact" />
      )}

      {isLoading ? (
        <DashboardSkeleton />
      ) : (
        <>
          {/* Stat cards — catalog counters not covered by the chart below */}
          <div className="grid grid-cols-2 gap-2.5">
            {statCards.map((card) => (
              <Card key={card.label} className="border shadow-none hover:shadow-md transition-shadow duration-200">
                <CardContent className="flex items-center gap-2.5 p-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/50 text-muted-foreground">
                    <card.icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{card.label}</p>
                    <p className="text-base font-bold text-foreground truncate tracking-tight tabular-nums">
                      <AnimatedStatValue value={card.value} />
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Single chart — Revenue / Orders toggle + 3M / 6M / 12M range */}
          {!isWhatsAppOnly && (
            <Suspense fallback={<ShimmerBlock className="h-[280px] w-full rounded-xl" />}>
              <OverviewChart
                data={ordersByMonth}
                currencySymbol={currencySymbol}
                emptyState={
                  <>
                    <p className="text-xs text-muted-foreground">No sales data yet</p>
                    {store?.slug && store?.name && (
                      <ShareStoreDialog
                        storeSlug={store.slug}
                        storeName={store.name}
                        trigger={
                          <Button variant="outline" size="sm" className="gap-1.5 text-xs h-9">
                            <Share2 className="h-3 w-3" />
                            Share your store to get started
                          </Button>
                        }
                      />
                    )}
                  </>
                }
              />
            </Suspense>
          )}

          {/* Store Checklist — promoted above Pending Actions so new owners see setup tasks first */}
          {storeId && <StoreChecklist storeId={storeId} storeSlug={store?.slug || ""} />}

          {/* Pending Actions */}
          {storeId && !isWhatsAppOnly && <PendingActions storeId={storeId} storeSlug={store?.slug || ""} />}

          <Suspense fallback={<ShimmerBlock className="h-40 w-full rounded-xl" />}>
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
          </Suspense>
        </>
      )}

    </div>
  );
}
