import { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import OrderNotificationListener from "@/components/OrderNotificationListener";
import {
  LayoutDashboard, Package, ShoppingBag, Palette, Menu, X, LogOut,
  Upload, Users, UserCheck, Globe, Settings, CreditCard, Tag, Truck,
  Receipt, ShoppingCart, Store, ChevronRight, BarChart3, ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import ShareStoreDialog from "@/components/ShareStoreDialog";

export default function DashboardLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();

  const { data: store, isLoading: storeLoading } = useQuery({
    queryKey: ["my-store", user?.id],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("id, name, logo_url, slug")
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

  const go = (path: string) => {
    navigate(path);
    setMenuOpen(false);
  };

  const isActive = (path: string, exact?: boolean) =>
    exact ? location.pathname === path : location.pathname.startsWith(path);

  // Bottom nav items — the 4 most-used actions + menu
  const bottomNav = storeId
    ? [
        { label: "Home", icon: LayoutDashboard, path: "/dashboard", exact: true },
        { label: "Products", icon: Package, path: `/dashboard/stores/${storeId}/products`, exact: false },
        { label: "Orders", icon: ShoppingBag, path: `/dashboard/stores/${storeId}/orders`, exact: false },
        { label: "Theme", icon: Palette, path: `/dashboard/stores/${storeId}/theme`, exact: true },
      ]
    : [
        { label: "Home", icon: LayoutDashboard, path: "/dashboard", exact: true },
      ];

  // Full menu items grouped
  const menuSections = storeId
    ? [
        {
          title: "Store Management",
          items: [
            { label: "Bulk Upload", icon: Upload, path: `/dashboard/stores/${storeId}/products/bulk-upload` },
            { label: "Customers", icon: Users, path: `/dashboard/stores/${storeId}/customers` },
            { label: "Leads", icon: UserCheck, path: `/dashboard/stores/${storeId}/leads` },
            { label: "Abandoned Carts", icon: ShoppingCart, path: `/dashboard/stores/${storeId}/abandoned-carts` },
          ],
        },
        {
          title: "Payments & Shipping",
          items: [
            { label: "Payments", icon: CreditCard, path: `/dashboard/stores/${storeId}/payments` },
            { label: "Coupons", icon: Tag, path: `/dashboard/stores/${storeId}/coupons` },
            { label: "Shipping", icon: Truck, path: `/dashboard/stores/${storeId}/shipping` },
            { label: "Tax / GST", icon: Receipt, path: `/dashboard/stores/${storeId}/tax` },
          ],
        },
        {
          title: "Settings",
          items: [
            { label: "Domain", icon: Globe, path: `/dashboard/stores/${storeId}/domain` },
            { label: "Store Settings", icon: Settings, path: `/dashboard/stores/${storeId}/settings` },
            { label: "Account", icon: Settings, path: "/dashboard/settings" },
          ],
        },
      ]
    : [
        {
          title: "Settings",
          items: [
            { label: "Account", icon: Settings, path: "/dashboard/settings" },
          ],
        },
      ];

  return (
    <div
      className="min-h-screen flex flex-col bg-background"
      style={{ fontFamily: "'Changa', sans-serif", fontWeight: 400 }}
    >
      <OrderNotificationListener />

      {/* Top header */}
      <header className="sticky top-0 z-30 flex h-12 items-center justify-between border-b bg-card px-3">
        <div className="flex items-center gap-2 min-w-0">
          {store?.logo_url ? (
            <img src={store.logo_url} alt="" className="h-7 w-7 shrink-0 rounded-md border object-cover" />
          ) : (
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary">
              <Store className="h-3.5 w-3.5 text-primary-foreground" />
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
              className="h-8 w-8"
              onClick={() => window.open(`/store/${store.slug}`, "_blank")}
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          )}
          {store?.slug && <ShareStoreDialog storeSlug={store.slug} storeName={store.name} iconOnly />}
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-auto px-3 py-4 pb-20">
        <Outlet />
      </main>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 inset-x-0 z-30 border-t bg-card/95 backdrop-blur-md safe-area-pb">
        <div className="flex items-center justify-around h-14">
          {bottomNav.map((item) => {
            const active = isActive(item.path, item.exact);
            return (
              <button
                key={item.label}
                onClick={() => go(item.path)}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors min-w-0",
                  active
                    ? "text-primary"
                    : "text-muted-foreground"
                )}
              >
                <item.icon className={cn("h-5 w-5", active && "stroke-[2.5]")} />
                <span className="text-[10px] font-medium leading-tight">{item.label}</span>
              </button>
            );
          })}
          <button
            onClick={() => setMenuOpen(true)}
            className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-muted-foreground"
          >
            <Menu className="h-5 w-5" />
            <span className="text-[10px] font-medium leading-tight">More</span>
          </button>
        </div>
      </nav>

      {/* Full menu sheet */}
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="right" className="w-[280px] p-0 flex flex-col">
          <SheetHeader className="px-4 pt-4 pb-2">
            <SheetTitle className="text-left text-sm">Menu</SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-auto px-2 pb-4">
            {menuSections.map((section) => (
              <div key={section.title} className="mb-3">
                <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {section.title}
                </p>
                {section.items.map((item) => {
                  const active = isActive(item.path);
                  return (
                    <button
                      key={item.path}
                      onClick={() => go(item.path)}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
                        active
                          ? "bg-accent text-accent-foreground font-medium"
                          : "text-foreground hover:bg-accent/50"
                      )}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1 text-left">{item.label}</span>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          <Separator />
          <div className="p-3">
            <p className="mb-2 truncate px-1 text-xs text-muted-foreground">{user?.email}</p>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-muted-foreground hover:text-foreground"
              onClick={() => { signOut(); setMenuOpen(false); }}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
