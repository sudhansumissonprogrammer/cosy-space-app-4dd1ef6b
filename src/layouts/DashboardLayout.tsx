import { useState, useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import OrderNotificationListener from "@/components/OrderNotificationListener";
import {
  LayoutDashboard, Package, ShoppingBag, Menu, LogOut,
  Upload, Users, UserCheck, Globe, Settings, CreditCard, Tag, Truck,
  Receipt, ShoppingCart, Store, ChevronDown, ExternalLink, Palette,
  Search, User, Bell, X, BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import ShareStoreDialog from "@/components/ShareStoreDialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";

function MobileMenu({
  open,
  onClose,
  storeId,
  pendingOrders,
  isWhatsAppOnly,
}: {
  open: boolean;
  onClose: () => void;
  storeId: string | undefined;
  pendingOrders: number;
  isWhatsAppOnly: boolean;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut, user } = useAuth();

  const go = (path: string) => {
    navigate(path);
    onClose();
  };

  const isActive = (path: string, exact?: boolean) =>
    exact ? location.pathname === path : location.pathname.startsWith(path);

  type MenuItem = { label: string; icon: React.ElementType; path: string; exact?: boolean; badge?: number };
  type MenuSection = { title?: string; items: MenuItem[] };

  const menuSections: MenuSection[] = storeId
    ? [
        {
          title: "Customers",
          items: [
            { label: "Customers", icon: Users, path: `/dashboard/stores/${storeId}/customers` },
            { label: "Leads", icon: UserCheck, path: `/dashboard/stores/${storeId}/leads` },
            { label: "Abandoned Carts", icon: ShoppingCart, path: `/dashboard/stores/${storeId}/abandoned-carts` },
          ],
        },
        {
          title: "Marketing",
          items: [
            { label: "Coupons", icon: Tag, path: `/dashboard/stores/${storeId}/coupons` },
            { label: "Analytics", icon: BarChart3, path: `/dashboard/stores/${storeId}/analytics` },
          ],
        },
        {
          title: "Payments & Shipping",
          items: [
            { label: "Payments", icon: CreditCard, path: `/dashboard/stores/${storeId}/payments` },
            { label: "Shipping", icon: Truck, path: `/dashboard/stores/${storeId}/shipping` },
            { label: "Tax / GST", icon: Receipt, path: `/dashboard/stores/${storeId}/tax` },
          ],
        },
        {
          title: "Store",
          items: [
            { label: "Bulk Upload", icon: Upload, path: `/dashboard/stores/${storeId}/products/bulk-upload` },
            { label: "Theme", icon: Palette, path: `/dashboard/stores/${storeId}/theme` },
            { label: "Domain", icon: Globe, path: `/dashboard/stores/${storeId}/domain` },
            { label: "Store Settings", icon: Settings, path: `/dashboard/stores/${storeId}/settings` },
          ],
        },
      ]
    : [
        { items: [{ label: "Home", icon: LayoutDashboard, path: "/dashboard", exact: true }] },
      ];

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#1a1a1a]">
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
                  return (
                    <button
                      key={item.path}
                      onClick={() => go(item.path)}
                      className={cn(
                        "flex w-full items-center gap-3.5 rounded-xl px-4 py-3 text-[15px] transition-colors",
                        active
                          ? "bg-white/10 text-white font-medium"
                          : "text-[#b0b0b0] active:bg-white/5"
                      )}
                    >
                      <item.icon className="h-5 w-5 shrink-0" />
                      <span className="flex-1 text-left">{item.label}</span>
                      {item.badge !== undefined && item.badge > 0 && (
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
  const [pendingOrders, setPendingOrders] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const isMobile = useIsMobile();

  const { data: store, isLoading: storeLoading } = useQuery({
    queryKey: ["my-store", user?.id],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("id, name, logo_url, slug, order_mode")
        .eq("owner_id", user!.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const storeId = store?.id;
  const isWhatsAppOnly = store?.order_mode === "whatsapp";

  // Pending orders count + realtime (skip for WhatsApp-only stores)
  useEffect(() => {
    if (!storeId) return;
    const fetchCount = async () => {
      const { count } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("store_id", storeId)
        .eq("status", "pending");
      setPendingOrders(count ?? 0);
    };
    fetchCount();

    const channel = supabase
      .channel("mobile-nav-orders")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `store_id=eq.${storeId}` },
        () => fetchCount()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [storeId]);

  const go = (path: string) => {
    navigate(path);
    setMenuOpen(false);
  };

  const isActive = (path: string, exact?: boolean) =>
    exact ? location.pathname === path : location.pathname.startsWith(path);

  // Desktop layout with sidebar
  if (!isMobile) {
    return (
      <SidebarProvider>
        <div className="min-h-screen flex w-full" style={{ fontFamily: "'Changa', sans-serif", fontWeight: 400 }}>
          <AppSidebar />
          <div className="flex-1 flex flex-col min-w-0">
            <OrderNotificationListener />
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
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => window.open(`/store/${store.slug}`, "_blank")}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                )}
                {store?.slug && <ShareStoreDialog storeSlug={store.slug} storeName={store.name} iconOnly />}
              </div>
            </header>
            <main className="flex-1 overflow-auto p-6">
              <Outlet />
            </main>
          </div>
        </div>
      </SidebarProvider>
    );
  }

  // Mobile bottom nav items
  const bottomNav = storeId
    ? [
        { label: "Home", icon: LayoutDashboard, path: "/dashboard", exact: true },
        ...(!isWhatsAppOnly ? [{ label: "Orders", icon: ShoppingBag, path: `/dashboard/stores/${storeId}/orders`, exact: false, badge: pendingOrders }] : []),
        { label: "Products", icon: Package, path: `/dashboard/stores/${storeId}/products`, exact: false },
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
    <div
      className="min-h-screen flex flex-col bg-background"
      style={{ fontFamily: "'Changa', sans-serif", fontWeight: 400 }}
    >
      <OrderNotificationListener />

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

      <main className="flex-1 overflow-auto px-3 py-4 pb-24">
        <Outlet />
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
        storeId={storeId}
        pendingOrders={pendingOrders}
      />
    </div>
  );
}
