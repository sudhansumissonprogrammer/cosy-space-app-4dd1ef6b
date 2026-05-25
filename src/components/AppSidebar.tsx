import { useEffect, useState } from "react";
import {
  LayoutDashboard, Settings, LogOut, Package, Upload, ShoppingBag,
  Users, UserCheck, Globe, Store, Plus, CreditCard, Tag, Truck, Receipt,
  ShoppingCart, Palette, BarChart3, MessageSquare, FolderOpen, Image as ImageIcon,
  Clock, FileText, Star, Wallet,
} from "lucide-react";
import { prefetchDashboardRoutes } from "@/lib/prefetchDashboardRoutes";
import { NavLink } from "@/components/NavLink";
import { useLocation, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useMyStore } from "@/hooks/useMyStore";
import { useAdminStoreView } from "@/hooks/useAdminStoreView";
import { supabase } from "@/integrations/supabase/client";
import { useMenuConfig } from "@/hooks/useMenuConfig";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarFooter, useSidebar, SidebarMenuBadge,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { storeSlug: routeStoreSlug } = useParams<{ storeSlug: string }>();
  const { signOut, user } = useAuth();

  // Prefetch all dashboard page chunks on mount
  useEffect(() => { prefetchDashboardRoutes(); }, []);
  const [pendingOrders, setPendingOrders] = useState(0);

  const { data: ownStore, isLoading: ownStoreLoading } = useMyStore();
  const { adminStore } = useAdminStoreView(ownStore, ownStoreLoading);

  const routeNeedsAdminStore =
    !!routeStoreSlug &&
    (!ownStore ||
      (ownStore.slug !== routeStoreSlug && ownStore.id !== routeStoreSlug));

  const store = routeNeedsAdminStore ? adminStore : ownStore;

  const storeId = store?.id;
  const storeSlug = store?.slug ?? (routeNeedsAdminStore ? routeStoreSlug : ownStore?.slug);
  const isWhatsAppOnly = store?.order_mode === "whatsapp";
  const { isVisible, isComingSoon } = useMenuConfig();

  // Poll pending order count (replaces realtime WebSocket to save Supabase connections + DB queries).
  // Refetches every 60s while tab is visible, and immediately when tab becomes visible after being hidden.
  useEffect(() => {
    if (!storeId || isWhatsAppOnly) return;
    let cancelled = false;

    const fetchCount = async () => {
      const { count } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("store_id", storeId)
        .eq("status", "pending");
      if (!cancelled) setPendingOrders(count ?? 0);
    };

    fetchCount();
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") fetchCount();
    }, 60_000);

    const onVisibility = () => {
      if (document.visibilityState === "visible") fetchCount();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [storeId, isWhatsAppOnly]);

  const isActive = (path: string, exact?: boolean) =>
    exact ? location.pathname === path : location.pathname.startsWith(path);

  const catalogItems = storeSlug
    ? [
        { title: "Products", url: `/dashboard/stores/${storeSlug}/products`, icon: Package, menuKey: "products" },
        { title: "Best Sellers", url: `/dashboard/stores/${storeSlug}/best-sellers`, icon: Star, menuKey: "best_sellers" },
        { title: "Categories", url: `/dashboard/stores/${storeSlug}/categories`, icon: FolderOpen, menuKey: "categories" },
        { title: "Media Library", url: `/dashboard/stores/${storeSlug}/media`, icon: ImageIcon, menuKey: "media_library" },
        { title: "Bulk Upload", url: `/dashboard/stores/${storeSlug}/products/bulk-upload`, icon: Upload, menuKey: "bulk_upload" },
      ].filter((i) => isVisible(i.menuKey))
    : [];

  const salesItems = storeSlug && !isWhatsAppOnly
    ? [
        { title: "Orders", url: `/dashboard/stores/${storeSlug}/orders`, icon: ShoppingBag, badge: pendingOrders, menuKey: "orders" },
        { title: "Customers", url: `/dashboard/stores/${storeSlug}/customers`, icon: Users, menuKey: "customers" },
        { title: "Leads", url: `/dashboard/stores/${storeSlug}/leads`, icon: UserCheck, menuKey: "leads" },
        { title: "Abandoned Carts", url: `/dashboard/stores/${storeSlug}/abandoned-carts`, icon: ShoppingCart, menuKey: "abandoned_carts" },
      ].filter((i) => isVisible(i.menuKey))
    : [];

  const isCommissionMode = (store as any)?.billing_mode === "commission";

  const paymentItems = storeSlug
    ? [
        { title: "Payments", url: `/dashboard/stores/${storeSlug}/payments`, icon: CreditCard, menuKey: "payments" },
        ...(isCommissionMode ? [{ title: "Wallet", url: `/dashboard/stores/${storeSlug}/wallet`, icon: Wallet, menuKey: "wallet" }] : []),
        ...(!isWhatsAppOnly ? [{ title: "Coupons", url: `/dashboard/stores/${storeSlug}/coupons`, icon: Tag, menuKey: "coupons" }] : []),
        { title: "Shipping", url: `/dashboard/stores/${storeSlug}/shipping`, icon: Truck, menuKey: "shipping" },
        { title: "Tax / GST", url: `/dashboard/stores/${storeSlug}/tax`, icon: Receipt, menuKey: "tax_gst" },
      ].filter((i) => i.menuKey === "wallet" || isVisible(i.menuKey))
    : [];

  const marketingItems = storeSlug
    ? [
        ...(!isWhatsAppOnly ? [{ title: "WhatsApp Marketing", url: `/dashboard/stores/${storeSlug}/whatsapp`, icon: MessageSquare, menuKey: "whatsapp_marketing" }] : []),
        { title: "Tracking & Analytics", url: `/dashboard/stores/${storeSlug}/tracking`, icon: BarChart3, menuKey: "tracking_analytics" },
      ].filter((i) => isVisible(i.menuKey))
    : [];

  const settingsItems = storeSlug
    ? [
        { title: "Theme", url: `/dashboard/stores/${storeSlug}/theme`, icon: Palette, menuKey: "theme" },
        { title: "Pages", url: `/dashboard/stores/${storeSlug}/pages`, icon: FileText, menuKey: "pages" },
        { title: "Domain", url: `/dashboard/stores/${storeSlug}/domain`, icon: Globe, menuKey: "domain" },
        { title: "Store Settings", url: `/dashboard/stores/${storeSlug}/settings`, icon: Settings, menuKey: "store_settings" },
      ].filter((i) => isVisible(i.menuKey))
    : [];

  const renderGroup = (
    label: string,
    items: { title: string; url: string; icon: React.ElementType; badge?: number; menuKey?: string }[]
  ) => {
    if (items.length === 0) return null;
    return (
      <SidebarGroup key={label}>
        <SidebarGroupLabel className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/70 mb-1">{label}</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {items.map((item) => {
              const comingSoon = item.menuKey ? isComingSoon(item.menuKey) : false;
              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild={!comingSoon}
                    isActive={!comingSoon && isActive(item.url)}
                    className={comingSoon ? "opacity-50 cursor-not-allowed" : !comingSoon && isActive(item.url) ? "font-semibold" : "font-medium"}
                  >
                    {comingSoon ? (
                      <div className="flex items-center w-full hover:bg-transparent">
                        <item.icon className="mr-2 h-4 w-4" />
                        {!collapsed && (
                          <>
                            <span>{item.title}</span>
                            <Badge variant="outline" className="ml-auto text-[9px] px-1 py-0 h-4 border-amber-300 text-amber-600 shrink-0">
                              Soon
                            </Badge>
                          </>
                        )}
                      </div>
                    ) : (
                      <NavLink
                        to={item.url}
                        end
                        instant
                        className="hover:bg-accent/50"
                        activeClassName="bg-accent text-accent-foreground font-semibold"
                      >
                        <item.icon className="mr-2.5 h-4 w-4" />
                        {!collapsed && <span className="text-[13px]">{item.title}</span>}
                      </NavLink>
                    )}
                  </SidebarMenuButton>
                  {!comingSoon && item.badge !== undefined && item.badge > 0 && (
                    <SidebarMenuBadge>
                      <Badge
                        variant="destructive"
                        className="h-5 min-w-5 px-1.5 text-[10px] font-bold rounded-full"
                      >
                        {item.badge > 99 ? "99+" : item.badge}
                      </Badge>
                    </SidebarMenuBadge>
                  )}
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        {/* Store branding header */}
        <div className="flex h-16 items-center gap-3 px-4 border-b border-sidebar-border">
          {store?.logo_url ? (
            <img src={store.logo_url} alt="" className="h-9 w-9 shrink-0 rounded-xl border object-cover shadow-sm" />
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary shadow-sm">
              <Store className="h-4 w-4 text-primary-foreground" />
            </div>
          )}
          {!collapsed && (
            <span className="truncate text-[14px] font-bold tracking-tight text-foreground">
              {store?.name || "Store Admin"}
            </span>
          )}
        </div>

        {/* Dashboard */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/70 mb-1">Overview</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/dashboard", true)}>
                  <NavLink
                    to="/dashboard"
                    end
                    instant
                    className="hover:bg-accent/50"
                    activeClassName="bg-accent text-accent-foreground font-semibold"
                  >
                    <LayoutDashboard className="mr-2.5 h-4 w-4" />
                    {!collapsed && <span className="text-[13px]">Dashboard</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/dashboard/analytics", true)}>
                  <NavLink
                    to="/dashboard/analytics"
                    end
                    instant
                    className="hover:bg-accent/50"
                    activeClassName="bg-accent text-accent-foreground font-semibold"
                  >
                    <BarChart3 className="mr-2.5 h-4 w-4" />
                    {!collapsed && <span className="text-[13px]">Analytics</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {storeId ? (
          <>
            {renderGroup("Catalog", catalogItems)}
            {renderGroup("Sales & Customers", salesItems)}
            {renderGroup("Payments & Shipping", paymentItems)}
            {renderGroup("Marketing", marketingItems)}
            {renderGroup("Appearance & Settings", settingsItems)}
          </>
        ) : (
          <SidebarGroup>
            <SidebarGroupLabel>Store</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to="/dashboard/stores/create"
                      instant
                      className="hover:bg-accent/50"
                      activeClassName="bg-accent text-accent-foreground font-medium"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      {!collapsed && <span>Create Store</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Account */}
        <SidebarGroup>
          <SidebarGroupLabel>Account</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/dashboard/settings", true)}>
                  <NavLink
                    to="/dashboard/settings"
                    end
                    instant
                    className="hover:bg-accent/50"
                    activeClassName="bg-accent text-accent-foreground font-medium"
                  >
                    <Settings className="mr-2 h-4 w-4" />
                    {!collapsed && <span>Settings</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <Separator />
        <div className="p-2">
          {!collapsed && (
            <p className="mb-2 truncate px-2 text-xs text-muted-foreground">{user?.email}</p>
          )}
          <Button
            variant="ghost"
            size={collapsed ? "icon" : "sm"}
            className="w-full justify-start text-muted-foreground hover:text-foreground"
            onClick={signOut}
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && <span className="ml-2">Sign out</span>}
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
