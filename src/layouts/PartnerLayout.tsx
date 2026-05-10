import { Suspense, useEffect, useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Loader2, LogOut, LayoutDashboard, Wallet, ArrowDownToLine } from "lucide-react";
import { cn } from "@/lib/utils";
import { NotificationsBell } from "@/components/partner/NotificationsBell";
import { PartnerBottomNav } from "@/components/partner/PartnerBottomNav";

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
      let { data: p } = await supabase.from("partners").select("*").eq("user_id", session.user.id).maybeSingle();
      if (!p) {
        // Self-heal: signup-with-email-confirmation can land users here without a partner row.
        const meta = (session.user.user_metadata || {}) as any;
        if (meta.user_type === "partner" || meta.full_name) {
          await supabase.from("partners").insert({
            user_id: session.user.id,
            name: meta.full_name || session.user.email?.split("@")[0] || "Partner",
            email: session.user.email!,
            mobile: meta.mobile || null,
          });
          const re = await supabase.from("partners").select("*").eq("user_id", session.user.id).maybeSingle();
          p = re.data;
        }
      }
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

  const initial = (partner.name || "P").trim().charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-muted/20 font-dashboard">
      <header className="sticky top-0 z-30 border-b border-border/50 bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 text-sm font-bold text-primary-foreground shadow-sm">
              {initial}
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold text-foreground">{partner.name}</h1>
              <p className="truncate text-[11px] text-muted-foreground">
                <span className="font-mono">{partner.partner_code}</span> · Partner
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <NotificationsBell partnerId={partner.id} />
            <Button variant="ghost" size="sm" onClick={signOut} className="gap-1.5 text-xs">
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
        <nav className="mx-auto hidden max-w-6xl gap-1 px-2 pb-1 md:flex">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                )
              }
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl space-y-4 px-4 py-4 pb-24 md:py-6 md:pb-8">
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

      <PartnerBottomNav />
    </div>
  );
}
