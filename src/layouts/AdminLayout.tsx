import { Outlet, Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Shield, Users, ShoppingBag, LogOut, LayoutDashboard, CreditCard, BarChart3, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navItems = [
  { title: "Overview", url: "/admin", icon: LayoutDashboard },
  { title: "Users", url: "/admin/users", icon: Users },
  { title: "Stores", url: "/admin/stores", icon: Store },
  { title: "Orders", url: "/admin/orders", icon: ShoppingBag },
  { title: "Subscriptions", url: "/admin/subscriptions", icon: CreditCard },
  { title: "Analytics", url: "/admin/analytics", icon: BarChart3 },
];

export default function AdminLayout() {
  const { signOut, user } = useAuth();
  const location = useLocation();

  return (
    <div className="flex min-h-screen" style={{ fontFamily: "'Changa', sans-serif", fontWeight: 400 }}>
      <aside className="flex w-64 flex-col border-r bg-card">
        <div className="flex h-14 items-center gap-2 border-b px-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive">
            <Shield className="h-4 w-4 text-destructive-foreground" />
          </div>
          <span className="text-sm font-semibold text-foreground">Super Admin</span>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {navItems.map((item) => {
            const isActive = location.pathname === item.url;
            return (
              <Link
                key={item.url}
                to={item.url}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-accent text-accent-foreground font-medium"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.title}
              </Link>
            );
          })}
        </nav>

        <div className="border-t p-3">
          <p className="mb-2 truncate px-3 text-xs text-muted-foreground">{user?.email}</p>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground hover:text-foreground"
            onClick={signOut}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </Button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col">
        <header className="h-14 flex items-center border-b bg-card px-6">
          <h2 className="text-sm font-medium text-foreground">Admin Panel</h2>
        </header>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
