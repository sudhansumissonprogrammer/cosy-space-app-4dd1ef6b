import { Suspense, useEffect, useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Loader2, LogOut, LayoutDashboard, Wallet, ArrowDownToLine } from "lucide-react";
import { cn } from "@/lib/utils";
import { NotificationsBell } from "@/components/partner/NotificationsBell";

// Prefetch sibling tab chunks so tab switches are instant (no skeleton flash).
const prefetchPartnerTabs = () => {
  import("@/pages/partner/PartnerOverview").catch(() => {});
  import("@/pages/partner/PartnerWallet").catch(() => {});
  import("@/pages/partner/PartnerWithdrawals").catch(() => {});
};

export default function PartnerLayout() {
  const navigate = useNavigate();
  const { session, loading: authLoading, signOut } = useAuth();
  const [partner, setPartner] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!session) { navigate("/partners/login", { replace: true }); return; }
    (async () => {
      const { data: p } = await supabase.from("partners").select("*").eq("user_id", session.user.id).maybeSingle();
      if (!p) { navigate("/partners/signup", { replace: true }); return; }
      setPartner(p);
      setLoading(false);
      prefetchPartnerTabs();
    })();
  }, [session, authLoading, navigate]);

  if (loading || !partner) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  const tabs = [
    { to: "/partners/dashboard", label: "Overview", icon: LayoutDashboard, end: true },
    { to: "/partners/dashboard/wallet", label: "Wallet", icon: Wallet },
    { to: "/partners/dashboard/withdrawals", label: "Withdrawals", icon: ArrowDownToLine },
  ];

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="sticky top-0 z-30 border-b border-border/50 bg-background">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <div>
            <h1 className="text-sm font-semibold text-foreground">Partner Dashboard</h1>
            <p className="text-xs text-muted-foreground">{partner.partner_code} · {partner.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <NotificationsBell partnerId={partner.id} />
            <Button variant="ghost" size="sm" onClick={async () => { navigate("/partners/login", { replace: true }); await signOut(); }}>
              <LogOut className="mr-2 h-4 w-4" />Sign out
            </Button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-2 pb-1">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) => cn(
                "flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <Suspense
          fallback={
            <div className="flex justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          }
        >
          <Outlet context={{ partner }} />
        </Suspense>
      </main>
    </div>
  );
}
