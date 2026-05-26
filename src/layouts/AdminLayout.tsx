import { useState, Suspense } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { ContentSkeleton } from "@/components/ContentSkeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { AdminSidebar } from "@/components/AdminSidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { AdminBreadcrumbs } from "@/components/AdminBreadcrumbs";
import { AdminCommandPalette } from "@/components/AdminCommandPalette";
import { cn } from "@/lib/utils";
import {
  Shield, LayoutDashboard, Users, ShoppingBag, CreditCard,
  BarChart3, MessageSquare, Settings, Menu, X, LogOut, User,
  Wallet, Handshake, Activity, AlertTriangle, Search,
} from "lucide-react";

function AdminMobileMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useAuth();

  const go = (path: string) => { navigate(path); onClose(); };
  const isActive = (path: string, exact?: boolean) =>
    exact ? location.pathname === path : location.pathname.startsWith(path);

  const sections = [
    {
      title: "Management",
      items: [
        { label: "Users & Stores", icon: Users, path: "/admin/users-stores" },
        { label: "Orders", icon: ShoppingBag, path: "/admin/orders" },
        { label: "Subscriptions", icon: CreditCard, path: "/admin/subscriptions" },
        { label: "Commission Wallets", icon: Wallet, path: "/admin/wallets" },
      ],
    },
    {
      title: "Partners",
      items: [
        { label: "Referral Partners", icon: Handshake, path: "/admin/partners" },
        { label: "Partner Payouts", icon: Handshake, path: "/admin/partners/payouts" },
        { label: "Partner Audit", icon: Handshake, path: "/admin/partners/audit" },
      ],
    },
    {
      title: "Marketing & Analytics",
      items: [
        { label: "WhatsApp", icon: MessageSquare, path: "/admin/whatsapp" },
        { label: "Analytics", icon: BarChart3, path: "/admin/analytics" },
        { label: "Usage Monitor", icon: Activity, path: "/admin/usage" },
        { label: "Error Logs", icon: AlertTriangle, path: "/admin/error-logs" },
      ],
    },
    {
      title: "Configuration",
      items: [
        { label: "Menu Control", icon: Menu, path: "/admin/menu-config" },
        { label: "Settings", icon: Settings, path: "/admin/settings" },
        { label: "Sign out", icon: LogOut, path: "__signout__" },
      ],
    },
  ];

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-sidebar font-dashboard">
      <div className="flex-1 overflow-auto px-4 pt-6 pb-4">
        <div className="space-y-4">
          {sections.map((section, si) => (
            <div key={si}>
              <p className="px-4 pb-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                {section.title}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const isSignOut = item.path === "__signout__";
                  const active = !isSignOut && isActive(item.path);
                  return (
                    <button
                      key={item.path}
                      onClick={() => {
                        if (isSignOut) { signOut(); onClose(); }
                        else go(item.path);
                      }}
                      className={cn(
                        "flex w-full items-center gap-3.5 rounded-xl px-4 py-3 text-[15px] transition-colors",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                          : "text-sidebar-foreground/70 active:bg-sidebar-accent/50"
                      )}
                    >
                      <item.icon className="h-5 w-5 shrink-0" />
                      <span className="flex-1 text-left">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="safe-area-pb px-4 pb-4 pt-2 flex items-center justify-center">
        <button
          onClick={onClose}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-sidebar-accent"
          aria-label="Close menu"
        >
          <X className="h-5 w-5 text-sidebar-accent-foreground" />
        </button>
      </div>
    </div>
  );
}

export default function AdminLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  useAuth(); // keep session subscription active
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string, exact?: boolean) =>
    exact ? location.pathname === path : location.pathname.startsWith(path);

  const go = (path: string) => { navigate(path); setMenuOpen(false); };

  // Desktop layout — matches store owner panel
  if (!isMobile) {
    return (
      <SidebarProvider>
        <div className="min-h-screen flex w-full font-dashboard">
          <AdminSidebar />
          <div className="flex-1 flex flex-col min-w-0">
            <header className="sticky top-0 z-30 flex h-12 items-center justify-between border-b bg-card px-4 gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <SidebarTrigger />
                <span className="text-sm font-semibold text-foreground shrink-0">Admin</span>
                <span className="text-muted-foreground/40 shrink-0">/</span>
                <div className="min-w-0 truncate">
                  <AdminBreadcrumbs />
                </div>
              </div>
              <button
                onClick={() => setCmdOpen(true)}
                className="inline-flex items-center gap-2 h-8 px-3 rounded-md border bg-background text-xs text-muted-foreground hover:bg-accent shrink-0"
                aria-label="Search"
              >
                <Search className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Search…</span>
                <kbd className="hidden md:inline ml-2 text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded">⌘K</kbd>
              </button>
            </header>
            <main className="flex-1 overflow-auto p-6">
              <Suspense fallback={<ContentSkeleton />}>
                <Outlet />
              </Suspense>
            </main>
          </div>
        </div>
        <AdminCommandPalette open={cmdOpen} onOpenChange={setCmdOpen} />
      </SidebarProvider>
    );
  }

  // Mobile layout — matches store owner mobile pattern
  // Replaced duplicate "Settings" with "Subscriptions" (higher-frequency screen);
  // Settings is still reachable via the top-right avatar and the More sheet.
  const bottomNav = [
    { label: "Home", icon: LayoutDashboard, path: "/admin", exact: true },
    { label: "Users", icon: Users, path: "/admin/users-stores" },
    { label: "Orders", icon: ShoppingBag, path: "/admin/orders" },
    { label: "Subs", icon: CreditCard, path: "/admin/subscriptions" },
    { label: "More", icon: Menu, path: "__menu__" },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background font-dashboard">
      {/* Mobile header */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between bg-sidebar px-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-destructive">
            <Shield className="h-4 w-4 text-destructive-foreground" />
          </div>
          <span className="truncate text-sm font-semibold text-sidebar-foreground">Super Admin</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-full"
          onClick={() => go("/admin/settings")}
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/80">
            <User className="h-4 w-4 text-destructive-foreground" />
          </div>
        </Button>
      </header>

      <main className="flex-1 overflow-auto px-3 py-4 pb-24">
        <Suspense fallback={<ContentSkeleton />}>
          <Outlet />
        </Suspense>
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 inset-x-0 z-30 bg-card border-t safe-area-pb">
        <div className="flex items-center justify-around h-16 px-1">
          {bottomNav.map((item) => {
            const isMenu = item.path === "__menu__";
            const active = !isMenu && isActive(item.path, item.exact);

            return (
              <button
                key={item.label}
                onClick={() => {
                  if (isMenu) setMenuOpen(true);
                  else go(item.path);
                }}
                className="relative flex flex-col items-center gap-0.5 px-2 py-1.5 min-w-0"
              >
                {active && (
                  <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 h-[3px] w-8 rounded-full bg-foreground" />
                )}
                <item.icon
                  className={cn(
                    "h-[22px] w-[22px] transition-colors",
                    active ? "text-foreground stroke-[2.5]" : "text-muted-foreground"
                  )}
                />
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

      <AdminMobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
      <AdminCommandPalette open={cmdOpen} onOpenChange={setCmdOpen} />
    </div>
  );
}
