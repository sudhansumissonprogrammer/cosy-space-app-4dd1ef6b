import { useEffect, useState } from "react";
import {
  LayoutDashboard, Settings, LogOut, Package, Upload, ShoppingBag,
  Users, UserCheck, Globe, Store, Plus, CreditCard, Tag, Truck, Receipt,
  ShoppingCart, Palette, BarChart3, MessageSquare, Bell, FolderOpen, Image as ImageIcon,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
  const { signOut, user } = useAuth();
  const [pendingOrders, setPendingOrders] = useState(0);

  const { data: store } = useQuery({
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

  // Fetch initial pending order count
  useEffect(() => {
    if (!storeId || isWhatsAppOnly) return;
    const fetchCount = async () => {
      const { count } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("store_id", storeId)
        .eq("status", "pending");
      setPendingOrders(count ?? 0);
    };
    fetchCount();
  }, [storeId]);

  // Real-time subscription for order changes
  useEffect(() => {
    if (!storeId || isWhatsAppOnly) return;
    const channel = supabase
      .channel("sidebar-orders")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `store_id=eq.${storeId}` },
        () => {
          // Re-fetch count on any order change
          supabase
            .from("orders")
            .select("*", { count: "exact", head: true })
            .eq("store_id", storeId)
            .eq("status", "pending")
            .then(({ count }) => setPendingOrders(count ?? 0));
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [storeId]);

  const isActive = (path: string, exact?: boolean) =>
    exact ? location.pathname === path : location.pathname.startsWith(path);

  const catalogItems = storeId
    ? [
        { title: "Products", url: `/dashboard/stores/${storeId}/products`, icon: Package },
        { title: "Categories", url: `/dashboard/stores/${storeId}/categories`, icon: FolderOpen },
        { title: "Media Library", url: `/dashboard/stores/${storeId}/media`, icon: ImageIcon },
        { title: "Bulk Upload", url: `/dashboard/stores/${storeId}/products/bulk-upload`, icon: Upload },
      ]
    : [];

  const salesItems = storeId && !isWhatsAppOnly
    ? [
        { title: "Orders", url: `/dashboard/stores/${storeId}/orders`, icon: ShoppingBag, badge: pendingOrders },
        { title: "Customers", url: `/dashboard/stores/${storeId}/customers`, icon: Users },
        { title: "Abandoned Carts", url: `/dashboard/stores/${storeId}/abandoned-carts`, icon: ShoppingCart },
      ]
    : [];

  const paymentItems = storeId
    ? [
        { title: "Payments", url: `/dashboard/stores/${storeId}/payments`, icon: CreditCard },
        ...(!isWhatsAppOnly ? [{ title: "Coupons", url: `/dashboard/stores/${storeId}/coupons`, icon: Tag }] : []),
        { title: "Shipping", url: `/dashboard/stores/${storeId}/shipping`, icon: Truck },
        { title: "Tax / GST", url: `/dashboard/stores/${storeId}/tax`, icon: Receipt },
      ]
    : [];

  const marketingItems = storeId
    ? [
        ...(!isWhatsAppOnly ? [{ title: "WhatsApp Marketing", url: `/dashboard/stores/${storeId}/whatsapp`, icon: MessageSquare }] : []),
        { title: "Push Notifications", url: `/dashboard/stores/${storeId}/notifications`, icon: Bell },
        { title: "Tracking & Analytics", url: `/dashboard/stores/${storeId}/tracking`, icon: BarChart3 },
      ]
    : [];

  const settingsItems = storeId
    ? [
        { title: "Theme", url: `/dashboard/stores/${storeId}/theme`, icon: Palette },
        { title: "Domain", url: `/dashboard/stores/${storeId}/domain`, icon: Globe },
        { title: "Store Settings", url: `/dashboard/stores/${storeId}/settings`, icon: Settings },
      ]
    : [];

  const renderGroup = (
    label: string,
    items: { title: string; url: string; icon: React.ElementType; badge?: number }[]
  ) => {
    if (items.length === 0) return null;
    return (
      <SidebarGroup key={label}>
        <SidebarGroupLabel>{label}</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {items.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton asChild isActive={isActive(item.url)}>
                  <NavLink
                    to={item.url}
                    end
                    className="hover:bg-accent/50"
                    activeClassName="bg-accent text-accent-foreground font-medium"
                  >
                    <item.icon className="mr-2 h-4 w-4" />
                    {!collapsed && <span>{item.title}</span>}
                  </NavLink>
                </SidebarMenuButton>
                {item.badge !== undefined && item.badge > 0 && (
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
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        {/* Store branding header */}
        <div className="flex h-14 items-center gap-2 px-4">
          {store?.logo_url ? (
            <img src={store.logo_url} alt="" className="h-8 w-8 shrink-0 rounded-lg border object-cover" />
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary">
              <Store className="h-4 w-4 text-primary-foreground" />
            </div>
          )}
          {!collapsed && (
            <span className="truncate text-sm font-semibold text-foreground">
              {store?.name || "Store Admin"}
            </span>
          )}
        </div>

        {/* Dashboard */}
        <SidebarGroup>
          <SidebarGroupLabel>Overview</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/dashboard", true)}>
                  <NavLink
                    to="/dashboard"
                    end
                    className="hover:bg-accent/50"
                    activeClassName="bg-accent text-accent-foreground font-medium"
                  >
                    <LayoutDashboard className="mr-2 h-4 w-4" />
                    {!collapsed && <span>Dashboard</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/dashboard/analytics", true)}>
                  <NavLink
                    to="/dashboard/analytics"
                    end
                    className="hover:bg-accent/50"
                    activeClassName="bg-accent text-accent-foreground font-medium"
                  >
                    <BarChart3 className="mr-2 h-4 w-4" />
                    {!collapsed && <span>Analytics</span>}
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
