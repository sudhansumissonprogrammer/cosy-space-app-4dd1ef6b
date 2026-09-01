import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LogOut, Store, Plus, Search, X, ChevronDown } from "lucide-react";
import { prefetchDashboardRoutes } from "@/lib/prefetchDashboardRoutes";
import { NavLink } from "@/components/NavLink";
import { useLocation, useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useMyStore } from "@/hooks/useMyStore";
import { useAdminStoreView } from "@/hooks/useAdminStoreView";
import { supabase } from "@/integrations/supabase/client";
import { useMenuConfig } from "@/hooks/useMenuConfig";
import { buildDashboardNav, filterNavGroups, searchNav } from "@/config/dashboardNav";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarFooter, useSidebar, SidebarMenuBadge,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  

  const { data: ownStore, isLoading: ownStoreLoading } = useMyStore();
  const { adminStore } = useAdminStoreView(ownStore, ownStoreLoading);

  const routeNeedsAdminStore =
    !!routeStoreSlug &&
    (!ownStore ||
      (ownStore.slug !== routeStoreSlug && ownStore.id !== routeStoreSlug));

  const store = routeNeedsAdminStore ? adminStore : ownStore;

  const storeId = store?.id;
  const storeSlug = store?.slug ?? (routeNeedsAdminStore ? routeStoreSlug : ownStore?.slug);
  const isWhatsAppOnly = false;
  const { isVisible, isComingSoon } = useMenuConfig();

  // Pending order count — replaces raw setInterval. React Query dedupes
  // across mount points, pauses while tab is hidden, and refetches on focus.
  const { data: pendingOrders = 0 } = useQuery({
    queryKey: ["sidebar-pending-orders", storeId],
    enabled: !!storeId && !isWhatsAppOnly,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
    queryFn: async () => {
      const { count } = await supabase
        .from("orders")
        .select("*", { count: "estimated", head: true })
        .eq("store_id", storeId!)
        .eq("status", "pending");
      return count ?? 0;
    },
  });

  const isActive = (path: string, exact?: boolean) =>
    exact ? location.pathname === path : location.pathname.startsWith(path);




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
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const results = useMemo(() => searchNav(navGroups, query), [navGroups, query]);

  const navigate = useNavigate();


  const renderItem = (item: (typeof navGroups)[number]["items"][number]) => {
    const comingSoon = item.menuKey ? isComingSoon(item.menuKey) : false;
    const active = !comingSoon && isActive(item.path, item.exact);
    return (
      <SidebarMenuItem key={item.id}>
        <SidebarMenuButton
          asChild={!comingSoon}
          isActive={active}
          tooltip={collapsed ? item.label : undefined}
          className={comingSoon ? "opacity-50 cursor-not-allowed" : active ? "font-semibold" : "font-medium"}
        >
          {comingSoon ? (
            <div className="flex items-center w-full hover:bg-transparent">
              <item.icon className="mr-2 h-4 w-4" />
              {!collapsed && (
                <>
                  <span>{item.label}</span>
                  <Badge variant="outline" className="ml-auto text-[9px] px-1 py-0 h-4 border-amber-300 text-amber-600 shrink-0">
                    Soon
                  </Badge>
                </>
              )}
            </div>
          ) : (
            <NavLink
              to={item.path}
              end={item.exact}
              instant
              title={item.description}
              className="hover:bg-accent/50"
              activeClassName="bg-accent text-accent-foreground font-semibold"
            >
              <item.icon className="mr-2.5 h-4 w-4" />
              {!collapsed && <span className="text-[13px]">{item.label}</span>}
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
  };

  const renderGroup = (group: (typeof navGroups)[number]) => {
    const primary = group.items.filter((i) => !i.secondary);
    const secondary = group.items.filter((i) => i.secondary);
    // Auto-open the drawer when the current page lives inside it.
    const secondaryActive = secondary.some((i) => isActive(i.path, i.exact));
    const open = expandedGroups.includes(group.id) || secondaryActive;

    return (
      <SidebarGroup key={group.id}>
        <SidebarGroupLabel className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/70 mb-1">
          {group.title}
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {primary.map(renderItem)}
            {open && secondary.map(renderItem)}
            {secondary.length > 0 && !collapsed && !secondaryActive && (
              <SidebarMenuItem>
                <button
                  type="button"
                  onClick={() =>
                    setExpandedGroups((prev) =>
                      prev.includes(group.id) ? prev.filter((g) => g !== group.id) : [...prev, group.id],
                    )
                  }
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[12px] text-muted-foreground hover:bg-accent/40 hover:text-foreground"
                >
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
                  {open ? "Less" : `More (${secondary.length})`}
                </button>
              </SidebarMenuItem>
            )}
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

        {/* Find any setting */}
        {!collapsed && (
          <div className="px-3 pt-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find a setting…"
                aria-label="Search dashboard menus"
                className="h-8 pl-8 pr-7 text-[12px]"
              />
              {query && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setQuery("")}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        )}

        {!collapsed && query.trim() ? (
          <SidebarGroup>
            <SidebarGroupLabel className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/70 mb-1">
              {results.length ? "Results" : "No matches"}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {results.map((item) => (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      onClick={() => {
                        navigate(item.path);
                        setQuery("");
                      }}
                      className="h-auto flex-col items-start gap-0.5 py-2"
                    >
                      <span className="flex items-center gap-2 text-[13px] font-medium">
                        <item.icon className="h-4 w-4" />
                        {item.label}
                      </span>
                      <span className="pl-6 text-[11px] leading-snug text-muted-foreground line-clamp-2">
                        {item.description}
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : (
          navGroups.map(renderGroup)
        )}

        {!storeSlug && (
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
