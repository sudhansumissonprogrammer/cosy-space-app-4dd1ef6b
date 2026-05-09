import { useEffect } from "react";
import {
  LayoutDashboard, Settings, LogOut, Users, ShoppingBag,
  CreditCard, BarChart3, MessageSquare, Shield, Activity, AlertTriangle, Menu, Handshake,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { clearAdminViewSlug } from "@/lib/adminStoreSession";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export function AdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { signOut, user } = useAuth();

  // Clear admin-viewed store when admin returns to admin panel
  useEffect(() => { clearAdminViewSlug(); }, []);

  const isActive = (path: string, exact?: boolean) =>
    exact ? location.pathname === path : location.pathname.startsWith(path);

  const overviewItems = [
    { title: "Overview", url: "/admin", icon: LayoutDashboard, exact: true },
  ];

  const managementItems = [
    { title: "Users & Stores", url: "/admin/users-stores", icon: Users },
    { title: "Orders", url: "/admin/orders", icon: ShoppingBag },
    { title: "Subscriptions", url: "/admin/subscriptions", icon: CreditCard },
    { title: "Referral Partners", url: "/admin/partners", icon: Handshake },
  ];

  const marketingItems = [
    { title: "WhatsApp", url: "/admin/whatsapp", icon: MessageSquare },
    { title: "Analytics", url: "/admin/analytics", icon: BarChart3 },
    { title: "Usage Monitor", url: "/admin/usage", icon: Activity },
    { title: "Error Logs", url: "/admin/error-logs", icon: AlertTriangle },
  ];

  const settingsItems = [
    { title: "Menu Control", url: "/admin/menu-config", icon: Menu },
    { title: "Settings", url: "/admin/settings", icon: Settings },
  ];

  const renderGroup = (
    label: string,
    items: { title: string; url: string; icon: React.ElementType; exact?: boolean }[]
  ) => (
    <SidebarGroup key={label}>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild isActive={isActive(item.url, item.exact)}>
                <NavLink
                  to={item.url}
                  end={item.exact}
                  instant
                  className="hover:bg-accent/50"
                  activeClassName="bg-accent text-accent-foreground font-medium"
                >
                  <item.icon className="mr-2 h-4 w-4" />
                  {!collapsed && <span>{item.title}</span>}
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        {/* Admin branding header */}
        <div className="flex h-14 items-center gap-2 px-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-destructive">
            <Shield className="h-4 w-4 text-destructive-foreground" />
          </div>
          {!collapsed && (
            <span className="truncate text-sm font-semibold text-foreground">
              Super Admin
            </span>
          )}
        </div>

        {renderGroup("Overview", overviewItems)}
        {renderGroup("Management", managementItems)}
        {renderGroup("Marketing & Analytics", marketingItems)}
        {renderGroup("Configuration", settingsItems)}
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
