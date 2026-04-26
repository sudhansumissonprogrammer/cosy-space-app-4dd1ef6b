import { useState, useEffect, useMemo, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { prefetchDashboardRoutes } from "@/lib/prefetchDashboardRoutes";
import { Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import { ContentSkeleton } from "@/components/ContentSkeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useMyStore } from "@/hooks/useMyStore";
import { useAdminStoreView } from "@/hooks/useAdminStoreView";
import { AdminViewProvider } from "@/contexts/AdminViewContext";
import { DashboardStoreProvider } from "@/contexts/DashboardStoreContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

import DynamicPwaManifest from "@/components/storefront/DynamicPwaManifest";
import SmartInstallPrompt from "@/components/SmartInstallPrompt";
import BillingBanner from "@/components/billing/BillingBanner";
import BillingPaywall from "@/components/BillingPaywall";
import { useBillingState } from "@/hooks/useBillingState";
import {
  LayoutDashboard, Package, ShoppingBag, Menu, LogOut,
  Upload, Users, UserCheck, Globe, Settings, CreditCard, Tag, Truck,
  Receipt, ShoppingCart, Store, ChevronDown, ExternalLink, Palette,
  Search, User, Bell, X, BarChart3, MessageSquare, Clock, RefreshCw,
  Grid3X3, FileText, Star,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import ShareStoreDialog from "@/components/ShareStoreDialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { useMenuConfig } from "@/hooks/useMenuConfig";

function MobileMenu({
  open,
  onClose,
  storeSlug,
  pendingOrders,
  isWhatsAppOnly,
}: {
  open: boolean;
  onClose: () => void;
  storeSlug: string | undefined;
  pendingOrders: number;
  isWhatsAppOnly: boolean;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut, user } = useAuth();
  const { isVisible, isComingSoon } = useMenuConfig();

  const go = (path: string) => {
    navigate(path);
    onClose();
  };

  const isActive = (path: string, exact?: boolean) =>
    exact ? location.pathname === path : location.pathname.startsWith(path);

  type MenuItem = { label: string; icon: React.ElementType; path: string; exact?: boolean; badge?: number; menuKey?: string };
  type MenuSection = { title?: string; items: MenuItem[] };

  const filterItems = (items: MenuItem[]) =>
    items.filter((i) => !i.menuKey || isVisible(i.menuKey));

  const menuSections: MenuSection[] = storeSlug
    ? [
        {
          title: "Overview",
          items: [
            { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard", exact: true },
            { label: "Analytics", icon: BarChart3, path: "/dashboard/analytics", exact: true },
          ],
        },
        {
          title: "Catalog",
          items: filterItems([
            { label: "Products", icon: Package, path: `/dashboard/stores/${storeSlug}/products`, menuKey: "products" },
            { label: "Best Sellers", icon: Star, path: `/dashboard/stores/${storeSlug}/best-sellers`, menuKey: "best_sellers" },
            { label: "Categories", icon: Grid3X3, path: `/dashboard/stores/${storeSlug}/categories`, menuKey: "categories" },
            { label: "Media Library", icon: Upload, path: `/dashboard/stores/${storeSlug}/media`, menuKey: "media_library" },
            { label: "Bulk Upload", icon: Upload, path: `/dashboard/stores/${storeSlug}/products/bulk-upload`, menuKey: "bulk_upload" },
          ]),
        },
        ...(!isWhatsAppOnly
          ? [
              {
                title: "Sales & Customers",
                items: filterItems([
                  { label: "Orders", icon: ShoppingBag, path: `/dashboard/stores/${storeSlug}/orders`, badge: pendingOrders, menuKey: "orders" },
                  { label: "Customers", icon: Users, path: `/dashboard/stores/${storeSlug}/customers`, menuKey: "customers" },
                  { label: "Leads", icon: UserCheck, path: `/dashboard/stores/${storeSlug}/leads`, menuKey: "leads" },
                  { label: "Abandoned Carts", icon: ShoppingCart, path: `/dashboard/stores/${storeSlug}/abandoned-carts`, menuKey: "abandoned_carts" },
                ]),
              },
            ]
          : []),
        {
          title: "Payments & Shipping",
          items: filterItems([
            { label: "Payments", icon: CreditCard, path: `/dashboard/stores/${storeSlug}/payments`, menuKey: "payments" },
            ...(!isWhatsAppOnly ? [{ label: "Coupons", icon: Tag, path: `/dashboard/stores/${storeSlug}/coupons`, menuKey: "coupons" }] : []),
            { label: "Shipping", icon: Truck, path: `/dashboard/stores/${storeSlug}/shipping`, menuKey: "shipping" },
            { label: "Tax / GST", icon: Receipt, path: `/dashboard/stores/${storeSlug}/tax`, menuKey: "tax_gst" },
          ]),
        },
        {
          title: "Marketing",
          items: filterItems([
            ...(!isWhatsAppOnly ? [{ label: "WhatsApp Marketing", icon: MessageSquare, path: `/dashboard/stores/${storeSlug}/whatsapp`, menuKey: "whatsapp_marketing" }] : []),
            { label: "Tracking & Analytics", icon: BarChart3, path: `/dashboard/stores/${storeSlug}/tracking`, menuKey: "tracking_analytics" },
          ]),
        },
        {
          title: "Appearance & Settings",
          items: filterItems([
            { label: "Theme", icon: Palette, path: `/dashboard/stores/${storeSlug}/theme`, menuKey: "theme" },
            { label: "Pages", icon: FileText, path: `/dashboard/stores/${storeSlug}/pages`, menuKey: "pages" },
            { label: "Domain", icon: Globe, path: `/dashboard/stores/${storeSlug}/domain`, menuKey: "domain" },
            { label: "Store Settings", icon: Settings, path: `/dashboard/stores/${storeSlug}/settings`, menuKey: "store_settings" },
          ]),
        },
      ].filter((s) => s.items.length > 0)
    : [
        { items: [{ label: "Home", icon: LayoutDashboard, path: "/dashboard", exact: true }] },
      ];

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#1a1a1a] font-dashboard">
      {/* Scrollable menu items */}
      <div className="flex-1 overflow-auto px-4 pt-6 pb-4">
        <div className="space-y-4">
          {menuSections.map((section, si) => (
            <div key={si}>
              {section.title && (
                <p className="px-4 pb-1 text-[11px] font-semibold uppercase tracking-widest text-[#666]">
                  {section.title}
                </p>
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const active = isActive(item.path, item.exact);
                  const comingSoon = item.menuKey ? isComingSoon(item.menuKey) : false;
                  return (
                    <button
                      key={item.path}
                      onClick={() => !comingSoon && go(item.path)}
                      disabled={comingSoon}
                      className={cn(
                        "flex w-full items-center gap-3.5 rounded-xl px-4 py-3 text-[15px] transition-colors",
                        comingSoon
                          ? "opacity-40 cursor-not-allowed text-[#888]"
                          : active
                            ? "bg-white/10 text-white font-medium"
                            : "text-[#b0b0b0] active:bg-white/5"
                      )}
                    >
                      <item.icon className="h-5 w-5 shrink-0" />
                      <span className="flex-1 text-left">{item.label}</span>
                      {comingSoon && (
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-amber-400/50 text-amber-400 shrink-0">
                          Soon
                        </Badge>
                      )}
                      {!comingSoon && item.badge !== undefined && item.badge > 0 && (
                        <Badge className="h-5 min-w-5 px-1.5 text-[10px] font-bold rounded-full bg-red-500 text-white border-0">
                          {item.badge > 99 ? "99+" : item.badge}
                        </Badge>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom bar with Settings + Close */}
      <div className="safe-area-pb px-4 pb-4 pt-2 flex items-center gap-3 justify-center">
        <button
          onClick={() => go("/dashboard/settings")}
          className="flex items-center gap-2.5 rounded-full bg-[#2a2a2a] px-6 py-3"
        >
          <Settings className="h-5 w-5 text-white" />
          <span className="text-sm font-medium text-white">Settings</span>
        </button>
        <button
          onClick={onClose}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-[#2a2a2a]"
        >
          <X className="h-5 w-5 text-white" />
        </button>
      </div>
    </div>
  );
}

export default function DashboardLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isPurging, setIsPurging] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();
  const { storeSlug: routeStoreSlug } = useParams<{ storeSlug: string }>();
  const { signOut, user } = useAuth();
  const isMobile = useIsMobile();

  // Prefetch all dashboard page chunks on mount (covers mobile layout)
  useEffect(() => { prefetchDashboardRoutes(); }, []);

  const { data: ownStore, isLoading: storeLoading } = useMyStore();
  const { isAdminView, adminStore } = useAdminStoreView(ownStore, storeLoading);

  // Use admin store when admin-view is active (covers routes with AND without :storeSlug)
  const store = isAdminView ? adminStore : ownStore;

  const storeId = store?.id;
  const storeSlug = store?.slug ?? (isAdminView ? routeStoreSlug : ownStore?.slug);
  const isWhatsAppOnly = store?.order_mode === "whatsapp";
  const adminViewValue = useMemo(() => ({ isAdminView }), [isAdminView]);
  const dashboardStoreValue = useMemo(() => ({
    store,
    storeId,
    storeSlug,
    isLoading: storeLoading,
  }), [store, storeId, storeSlug, storeLoading]);

  // Billing paywall — only for own store with billing-driven suspension
  const ownStoreId = !isAdminView ? ownStore?.id : undefined;
  const { data: billingState } = useBillingState(ownStoreId);
  const showPaywall =
    !isAdminView &&
    !!ownStoreId &&
    billingState?.billing_status === "suspended" &&
    (ownStore as any)?.suspension_reason === "billing";

  // Pending orders count — shared with PendingActions via React Query
  const { data: pendingCount } = useQuery({
    queryKey: ["pending-actions", storeId],
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const [pendingOrders, carts] = await Promise.all([
        supabase.from("orders").select("id", { count: "exact", head: true }).eq("store_id", storeId!).eq("status", "pending"),
        supabase.from("abandoned_carts").select("id", { count: "exact", head: true }).eq("store_id", storeId!).eq("recovered", false),
      ]);
      return {
        pendingOrders: pendingOrders.count ?? 0,
        abandonedCarts: carts.count ?? 0,
      };
    },
    enabled: !!storeId && !isWhatsAppOnly,
  });
  const pendingOrders = pendingCount?.pendingOrders ?? 0;

  // Clear app badge when visiting orders page
  useEffect(() => {
    if (storeId && location.pathname.includes("/orders")) {
      try {
        if ("clearAppBadge" in navigator) {
          (navigator as any).clearAppBadge();
        }
      } catch {}
    }
  }, [location.pathname, storeId]);

  const go = (path: string) => {
    navigate(path);
    setMenuOpen(false);
  };

  const handlePurgeCache = async () => {
    if (!store?.slug || isPurging) return;
    setIsPurging(true);
    try {
      const { purgeStoreCache } = await import("@/lib/purgeStoreCache");
      const { prewarmStore } = await import("@/lib/prewarmStore");
      const ok = await purgeStoreCache(store.slug, (store as any).custom_domain);
      await prewarmStore(store.slug, (store as any).custom_domain);
      if (ok) {
        toast.success("Cache purged! Your store will show the latest changes.");
      } else {
        toast.info("Cache purge sent. Changes will appear shortly.");
      }
    } catch {
      toast.error("Failed to purge cache");
    } finally {
      setIsPurging(false);
    }
  };

  const isActive = (path: string, exact?: boolean) =>
    exact ? location.pathname === path : location.pathname.startsWith(path);

  // Desktop layout with sidebar
  if (!isMobile) {
    return (
      <AdminViewProvider value={adminViewValue}>
        <DashboardStoreProvider value={dashboardStoreValue}>
        <SidebarProvider>
          <DynamicPwaManifest storeName="ShopBanao" logoUrl="/images/shopbanao-logo.png" themeColor="#4361ee" startUrl="/dashboard" />
          <SmartInstallPrompt appName="ShopBanao" primaryColor="#4361ee" textColor="#ffffff" delay={15000} logoUrl="/images/shopbanao-logo.png" />
          <div className="min-h-screen flex w-full font-dashboard">
            <AppSidebar />
            <div className="flex-1 flex flex-col min-w-0">
              {isAdminView && (
                <div className="bg-amber-500 text-amber-950 text-center text-xs font-semibold py-1.5 px-4">
                  ⚡ Admin View — Viewing "{store?.name}" dashboard (read-only)
                </div>
              )}
              <header className="sticky top-0 z-30 flex h-12 items-center justify-between border-b bg-card px-4">
                <div className="flex items-center gap-2">
                  <SidebarTrigger />
                  <span className="text-sm font-semibold text-foreground">
                    {store?.name || "Dashboard"}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {store?.slug && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1.5 text-xs"
                      onClick={handlePurgeCache}
                      disabled={isPurging}
                      title="Purge edge cache — instantly refresh your live store"
                    >
                      <RefreshCw className={cn("h-3.5 w-3.5", isPurging && "animate-spin")} />
                      {isPurging ? "Purging…" : "Purge Cache"}
                    </Button>
                  )}
                  {store?.slug && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => window.open(`/store/${store.slug}`, "_blank")}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  )}
                  {store?.slug && <ShareStoreDialog storeSlug={store.slug} storeName={store.name} customDomain={(store as any).custom_domain} iconOnly />}
                </div>
              </header>
              <BillingBanner />
              <main className="flex-1 overflow-auto p-6">
                <Suspense fallback={<ContentSkeleton />}>
                  {showPaywall && ownStoreId
                    ? <BillingPaywall state={billingState!} storeId={ownStoreId} />
                    : <Outlet />}
                </Suspense>
              </main>
            </div>
          </div>
        </SidebarProvider>
        </DashboardStoreProvider>
      </AdminViewProvider>
    );
  }

  // Mobile bottom nav items
  const bottomNav = storeSlug
    ? [
        { label: "Home", icon: LayoutDashboard, path: "/dashboard", exact: true },
        ...(!isWhatsAppOnly ? [{ label: "Orders", icon: ShoppingBag, path: `/dashboard/stores/${storeSlug}/orders`, exact: false, badge: pendingOrders }] : []),
        { label: "Products", icon: Package, path: `/dashboard/stores/${storeSlug}/products`, exact: false },
        { label: "Categories", icon: Grid3X3, path: `/dashboard/stores/${storeSlug}/categories`, exact: false },
        { label: "More", icon: Menu, path: "__menu__", exact: false },
        { label: "Profile", icon: User, path: "/dashboard/settings", exact: true },
      ]
    : [
        { label: "Home", icon: LayoutDashboard, path: "/dashboard", exact: true },
        { label: "More", icon: Menu, path: "__menu__", exact: false },
        { label: "Profile", icon: User, path: "/dashboard/settings", exact: true },
      ];

  // Mobile layout
  return (
    <AdminViewProvider value={adminViewValue}>
    <DashboardStoreProvider value={dashboardStoreValue}>
    <DynamicPwaManifest storeName="ShopBanao" logoUrl="/images/shopbanao-logo.png" themeColor="#4361ee" startUrl="/dashboard" />
    <SmartInstallPrompt appName="ShopBanao" primaryColor="#4361ee" textColor="#ffffff" delay={10000} logoUrl="/images/shopbanao-logo.png" />
    <div
      className="min-h-screen flex flex-col bg-background font-dashboard"
      
    >
      {isAdminView && (
        <div className="bg-amber-500 text-amber-950 text-center text-xs font-semibold py-1.5 px-4">
          ⚡ Admin View — Viewing "{store?.name}"
        </div>
      )}

      {/* Shopify-style header */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between bg-[#1a1a1a] px-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {store?.logo_url ? (
            <img src={store.logo_url} alt="" className="h-8 w-8 shrink-0 rounded-lg border border-white/10 object-cover" />
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500">
              <span className="text-xs font-bold text-white">
                {store?.name?.slice(0, 3)?.toLowerCase() || "str"}
              </span>
            </div>
          )}
          <span className="truncate text-sm font-semibold text-white">
            {store?.name || "Dashboard"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {store?.slug && (
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-white/70 hover:text-white hover:bg-white/10"
              onClick={handlePurgeCache}
              disabled={isPurging}
              title="Purge cache"
            >
              <RefreshCw className={cn("h-5 w-5", isPurging && "animate-spin")} />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-white/70 hover:text-white hover:bg-white/10"
            onClick={() => {/* notification bell */}}
          >
            <Bell className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-full"
            onClick={() => go("/dashboard/settings")}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-500">
              <User className="h-4 w-4 text-white" />
            </div>
          </Button>
        </div>
      </header>

      <BillingBanner />

      <main className="flex-1 overflow-auto px-3 py-4 pb-24">
        <Suspense fallback={<ContentSkeleton />}>
          <Outlet />
        </Suspense>
      </main>

      {/* Shopify-style bottom nav */}
      <nav className="fixed bottom-0 inset-x-0 z-30 bg-card border-t safe-area-pb">
        <div className="flex items-center justify-around h-16 px-1">
          {bottomNav.map((item) => {
            const isMenu = item.path === "__menu__";
            const isSearch = item.path === "__search__";
            const active = !isMenu && !isSearch && isActive(item.path, item.exact);

            return (
              <button
                key={item.label}
                onClick={() => {
                  if (isMenu) {
                    setMenuOpen(true);
                  } else if (isSearch) {
                    // Could open a search overlay in the future
                  } else {
                    go(item.path);
                  }
                }}
                className="relative flex flex-col items-center gap-0.5 px-2 py-1.5 min-w-0"
              >
                {/* Active pill indicator */}
                {active && (
                  <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 h-[3px] w-8 rounded-full bg-foreground" />
                )}
                <div className="relative">
                  <item.icon
                    className={cn(
                      "h-[22px] w-[22px] transition-colors",
                      active ? "text-foreground stroke-[2.5]" : "text-muted-foreground"
                    )}
                  />
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="absolute -top-1.5 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                      {item.badge > 99 ? "99+" : item.badge}
                    </span>
                  )}
                </div>
                <span
                  className={cn(
                    "text-[10px] leading-tight",
                    active ? "font-semibold text-foreground" : "text-muted-foreground"
                  )}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Full-screen dark menu (Shopify style) */}
      <MobileMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        storeSlug={storeSlug}
        pendingOrders={pendingOrders}
        isWhatsAppOnly={isWhatsAppOnly}
      />
    </div>
    </DashboardStoreProvider>
    </AdminViewProvider>
  );
}
