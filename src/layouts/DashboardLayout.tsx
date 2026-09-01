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
import LowBalanceDialog from "@/components/billing/LowBalanceDialog";
import {
  LayoutDashboard, Package, ShoppingBag, Menu, LogOut,
  Settings, Store, ExternalLink,
  Search, User, X, RefreshCw,
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
import { buildDashboardNav, filterNavGroups, searchNav } from "@/config/dashboardNav";

function MobileMenu({
  open,
  onClose,
  storeSlug,
  pendingOrders,
  isWhatsAppOnly,
  isCommissionMode,
}: {
  open: boolean;
  onClose: () => void;
  storeSlug: string | undefined;
  pendingOrders: number;
  isWhatsAppOnly: boolean;
  isCommissionMode: boolean;
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

  const navGroups = useMemo(
    () =>
      filterNavGroups(
        buildDashboardNav({ storeSlug, isCommissionMode, isWhatsAppOnly, pendingOrders }),
        isVisible,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [storeSlug, isCommissionMode, isWhatsAppOnly, pendingOrders, isVisible],
  );

  const [query, setQuery] = useState("");
  const results = useMemo(() => searchNav(navGroups, query), [navGroups, query]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  if (!open) return null;


  const renderItem = (item: (typeof navGroups)[number]["items"][number]) => {
    const active = isActive(item.path, item.exact);
    const comingSoon = item.menuKey ? isComingSoon(item.menuKey) : false;
    return (
      <button
        key={item.id}
        onClick={() => !comingSoon && go(item.path)}
        disabled={comingSoon}
        className={cn(
          "flex w-full items-center gap-3.5 rounded-xl px-4 py-3 text-left text-[15px] transition-colors min-h-[48px]",
          comingSoon
            ? "opacity-40 cursor-not-allowed text-muted-foreground"
            : active
              ? "bg-accent text-accent-foreground font-medium"
              : "text-muted-foreground active:bg-accent/60"
        )}
      >
        <item.icon className="h-5 w-5 shrink-0" />
        <span className="flex-1 min-w-0">
          <span className="block truncate">{item.label}</span>
          <span className="block truncate text-[11px] text-muted-foreground/80">{item.description}</span>
        </span>
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
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background text-foreground font-dashboard">
      {/* Search */}
      <div className="safe-area-pt px-4 pt-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search menus and settings…"
            aria-label="Search dashboard menus"
            className="h-11 w-full rounded-xl border border-border bg-card pl-10 pr-10 text-[14px] outline-none focus:ring-2 focus:ring-ring"
          />
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-2 text-muted-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Scrollable menu items */}
      <div className="flex-1 overflow-auto px-4 pt-4 pb-4">
        {query.trim() ? (
          <div className="space-y-0.5">
            {results.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                Nothing matches “{query}”.
              </p>
            ) : (
              results.map(renderItem)
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {navGroups.map((group) => (
              <div key={group.id}>
                <p className="px-4 pb-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {group.title}
                </p>
                <div className="space-y-0.5">{group.items.map(renderItem)}</div>
              </div>
            ))}
          </div>
        )}
      </div>


      {/* Bottom bar with Settings + Close */}
      <div className="safe-area-pb px-4 pb-4 pt-2 flex items-center gap-3 justify-center">
        <button
          onClick={() => go("/dashboard/settings")}
          className="flex items-center gap-2.5 rounded-full border border-border bg-card px-6 py-3 shadow-sm"
        >
          <Settings className="h-5 w-5 text-foreground" />
          <span className="text-sm font-medium text-foreground">Settings</span>
        </button>
        <button
          onClick={onClose}
          className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card shadow-sm"
        >
          <X className="h-5 w-5 text-foreground" />
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
  const isWhatsAppOnly = false;
  const adminViewValue = useMemo(() => ({ isAdminView }), [isAdminView]);
  const dashboardStoreValue = useMemo(() => ({
    store,
    storeId,
    storeSlug,
    isLoading: storeLoading,
  }), [store, storeId, storeSlug, storeLoading]);

  // Commission-only model: no subscription paywall. Wallet low-balance lock only.
  const ownStoreId = !isAdminView ? ownStore?.id : undefined;
  const showPaywall = false;
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
  const walletBalance = Number((walletSummary as any)?.wallet?.balance ?? 0);
  const isWalletRoute = location.pathname.includes("/wallet");
  // Allow the user's profile/settings page through the low-balance gate so
  // the merchant can always reach account settings and sign out even when
  // their wallet is blocked.
  const isAccountRoute =
    location.pathname === "/dashboard/settings" ||
    location.pathname.startsWith("/dashboard/settings/");
  // Merchants with more than one store must still be able to reach the store
  // picker (and each store's own wallet) while one store is locked.
  const isStorePickerRoute =
    location.pathname === "/dashboard" || location.pathname === "/dashboard/stores";
  const showLowBalance =
    !isAdminView &&
    !!walletSummary &&
    !!storeSlug &&
    walletBalance <= -20 &&
    !isWalletRoute &&
    !isStorePickerRoute &&
    !isAccountRoute;


  // Pending orders count — shared with PendingActions via React Query
  const { data: pendingCount } = useQuery({
    queryKey: ["pending-actions", storeId],
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const [pendingOrders, carts] = await Promise.all([
        supabase.from("orders").select("id", { count: "estimated", head: true }).eq("store_id", storeId!).eq("status", "pending"),
        supabase.from("abandoned_carts").select("id", { count: "estimated", head: true }).eq("store_id", storeId!).eq("recovered", false),
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
      const ok = await purgeStoreCache(store.slug, (store as any).custom_domain, { shell: true });
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
          <SmartInstallPrompt appName="ShopBanao" primaryColor="#4361ee" textColor="#ffffff" delay={15000} logoUrl="/images/shopbanao-logo.png" stripVariant="light" />
          <div className="min-h-screen flex w-full font-dashboard [&_*]:font-dashboard">
            <AppSidebar />
            <div className="flex-1 flex flex-col min-w-0">
              {isAdminView && (
                <div className="bg-amber-500 text-amber-950 text-center text-xs font-semibold py-1.5 px-4">
                  ⚡ Admin View — Editing "{store?.name}" dashboard (full access)
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
                      className="h-9 gap-1.5 text-xs"
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
                      className="h-9 w-9"
                      onClick={() => window.open(`/store/${store.slug}`, "_blank")}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  )}
                  {store?.slug && <ShareStoreDialog storeSlug={store.slug} storeName={store.name} customDomain={(store as any).custom_domain} iconOnly />}
                </div>
              </header>
              <main className="flex-1 overflow-auto p-6">
                <Suspense fallback={<ContentSkeleton />}>
                  <Outlet />
                </Suspense>
              </main>

            </div>
          </div>
        </SidebarProvider>
        {showLowBalance && <LowBalanceDialog open={true} balance={walletBalance} storeSlug={storeSlug || ""} />}
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
    <SmartInstallPrompt appName="ShopBanao" primaryColor="#4361ee" textColor="#ffffff" delay={10000} logoUrl="/images/shopbanao-logo.png" stripVariant="light" />
    <div
      className="min-h-screen flex flex-col bg-background font-dashboard [&_*]:font-dashboard"
      
    >
      {isAdminView && (
        <div className="bg-amber-500 text-amber-950 text-center text-xs font-semibold py-1.5 px-4">
          ⚡ Admin View — Editing "{store?.name}" (full access)
        </div>
      )}

      {/* Shopify-style header */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-card px-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {store?.logo_url ? (
            <img src={store.logo_url} alt="" className="h-8 w-8 shrink-0 rounded-lg border border-border object-cover" />
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary">
              <span className="text-xs font-bold text-primary-foreground">
                {store?.name?.slice(0, 3)?.toLowerCase() || "str"}
              </span>
            </div>
          )}
          <span className="truncate text-sm font-semibold text-foreground">
            {store?.name || "Dashboard"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {store?.slug && (
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground hover:text-foreground"
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
            className="h-9 w-9 text-muted-foreground hover:text-foreground"
            onClick={() => setMenuOpen(true)}
            aria-label="Search dashboard menus"
            title="Search menus"
          >
            <Search className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-full"
            onClick={() => go("/dashboard/settings")}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary">
              <User className="h-4 w-4 text-primary-foreground" />
            </div>
          </Button>
        </div>
      </header>

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
            const active = !isMenu && isActive(item.path, item.exact);

            return (
              <button
                key={item.label}
                onClick={() => {
                  if (isMenu) {
                    setMenuOpen(true);
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
        isCommissionMode={true}
      />
    </div>
    {showLowBalance && <LowBalanceDialog open={true} balance={walletBalance} storeSlug={storeSlug || ""} />}
    </DashboardStoreProvider>
    </AdminViewProvider>
  );
}
