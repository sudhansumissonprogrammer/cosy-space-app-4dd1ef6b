import { Suspense, useEffect, useState } from "react";
import { Outlet, NavLink, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, LogOut, LayoutDashboard, Wallet, ArrowDownToLine } from "lucide-react";
import { cn } from "@/lib/utils";
import { NotificationsBell } from "@/components/partner/NotificationsBell";
import logo from "@/assets/shopbanao-logo.webp";

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
    return (
      <div className="flex min-h-screen items-center justify-center bg-bauhaus-canvas">
        <Loader2 className="h-6 w-6 animate-spin text-foreground" />
      </div>
    );
  }

  const tabs = [
    { to: "/partners/dashboard", label: "Overview", icon: LayoutDashboard, end: true },
    { to: "/partners/dashboard/wallet", label: "Wallet", icon: Wallet },
    { to: "/partners/dashboard/withdrawals", label: "Withdrawals", icon: ArrowDownToLine },
  ];

  return (
    <div className="min-h-screen bg-bauhaus-canvas">
      <header className="sticky top-0 z-30 bg-bauhaus-white border-b-4 border-foreground">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 md:h-16 items-center justify-between">
            <Link to="/" className="flex items-center -space-x-1">
              <img src={logo} alt="ShopBanao" className="h-10 md:h-12 w-auto" />
              <span className="hidden sm:inline text-xl md:text-2xl text-foreground" style={{ fontFamily: "'Alegreya SC', serif", fontWeight: 700 }}>
                ShopBanao
              </span>
              <span className="ml-2 border-2 border-foreground bg-bauhaus-yellow px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-foreground shadow-bauhaus-sm">
                Partner
              </span>
            </Link>
            <div className="flex items-center gap-2">
              <div className="hidden sm:block text-right pr-2">
                <p className="font-bold uppercase tracking-widest text-[10px] text-muted-foreground">Code</p>
                <p className="font-black text-sm text-foreground">{partner.partner_code}</p>
              </div>
              <NotificationsBell partnerId={partner.id} />
              <button
                onClick={signOut}
                className="inline-flex items-center gap-1.5 bg-bauhaus-white text-foreground font-bold uppercase tracking-wider text-[11px] px-3 py-2 border-2 border-foreground shadow-bauhaus-sm hover:bg-muted active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </div>
          </div>

          <nav className="flex gap-2 overflow-x-auto pb-2">
            {tabs.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.end}
                className={({ isActive }) => cn(
                  "inline-flex items-center gap-2 whitespace-nowrap border-2 border-foreground px-3 py-2 font-bold uppercase tracking-wider text-[11px] transition-all",
                  isActive
                    ? "bg-bauhaus-red text-primary-foreground shadow-bauhaus-sm"
                    : "bg-bauhaus-white text-foreground hover:bg-bauhaus-yellow"
                )}
              >
                <t.icon className="h-3.5 w-3.5" />
                {t.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-5 sm:space-y-6">
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
