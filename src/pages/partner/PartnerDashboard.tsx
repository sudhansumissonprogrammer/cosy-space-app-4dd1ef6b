import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Copy, LogOut, Share2, Loader2, IndianRupee, Users, MousePointerClick, CheckCircle2 } from "lucide-react";
import { buildReferralLink } from "@/lib/referralTracking";

interface Partner {
  id: string;
  partner_code: string;
  name: string;
  email: string;
  commission_percentage: number;
  total_earnings: number;
  status: string;
}

interface Stats { clicks: number; signups: number; paid: number; totalEarned: number; pending: number; approved: number; }

export default function PartnerDashboard() {
  const navigate = useNavigate();
  const { session, loading: authLoading, signOut } = useAuth();
  const [partner, setPartner] = useState<Partner | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [referrals, setReferrals] = useState<any[]>([]);
  const [commissions, setCommissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!session) { navigate("/partners/login", { replace: true }); return; }
    (async () => {
      try {
        const { data: p } = await supabase.from("partners").select("*").eq("user_id", session.user.id).maybeSingle();
        if (!p) { navigate("/partners/signup", { replace: true }); return; }
        setPartner(p as Partner);

        const { data: statsRes } = await supabase.functions.invoke("partner-stats", { body: {} });
        if (statsRes?.stats) setStats(statsRes.stats);

        const [{ data: refs }, { data: comms }] = await Promise.all([
          supabase.from("partner_referrals").select("id,status,created_at,first_paid_at,store_id").eq("partner_id", p.id).order("created_at", { ascending: false }).limit(20),
          supabase.from("partner_commissions").select("id,amount_paid,commission_amount,percentage,status,created_at").eq("partner_id", p.id).order("created_at", { ascending: false }).limit(20),
        ]);
        setReferrals(refs || []);
        setCommissions(comms || []);
      } finally { setLoading(false); }
    })();
  }, [session, authLoading, navigate]);

  if (loading || !partner) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  const refLink = buildReferralLink(partner.partner_code);
  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); toast.success("Copied!"); } catch { toast.error("Copy failed"); }
  };
  const shareWhatsApp = () => {
    const msg = encodeURIComponent(`Build your online store on ShopBanao — ${refLink}`);
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  };
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(refLink)}`;

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="border-b border-border/50 bg-background">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <div>
            <h1 className="text-sm font-semibold text-foreground">Partner Dashboard</h1>
            <p className="text-xs text-muted-foreground">{partner.partner_code} · {partner.name}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut}><LogOut className="mr-2 h-4 w-4" />Sign out</Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        {/* Stats */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Clicks", value: stats?.clicks ?? 0, icon: MousePointerClick },
            { label: "Signups", value: stats?.signups ?? 0, icon: Users },
            { label: "Paid customers", value: stats?.paid ?? 0, icon: CheckCircle2 },
            { label: "Total earned", value: `₹${(stats?.totalEarned ?? 0).toLocaleString("en-IN")}`, icon: IndianRupee },
          ].map((s) => (
            <Card key={s.label} className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <s.icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="mt-2 text-2xl font-bold text-foreground">{s.value}</p>
            </Card>
          ))}
        </div>

        {/* Earnings split */}
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-foreground">Earnings</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">Pending</p>
              <p className="text-lg font-bold">₹{(stats?.pending ?? 0).toLocaleString("en-IN")}</p>
            </div>
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">Approved</p>
              <p className="text-lg font-bold">₹{(stats?.approved ?? 0).toLocaleString("en-IN")}</p>
            </div>
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">Commission rate</p>
              <p className="text-lg font-bold">{partner.commission_percentage}%</p>
            </div>
          </div>
        </Card>

        {/* Referral tools */}
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-foreground">Your referral link</h3>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start">
            <div className="flex-1 space-y-2">
              <div className="flex gap-2">
                <Input readOnly value={refLink} className="flex-1 font-mono text-xs" />
                <Button size="sm" variant="outline" onClick={() => copy(refLink)}><Copy className="mr-1 h-4 w-4" />Copy</Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={shareWhatsApp}><Share2 className="mr-1 h-4 w-4" />WhatsApp</Button>
                <Button size="sm" variant="outline" onClick={() => copy(partner.partner_code)}>Code: {partner.partner_code}</Button>
              </div>
            </div>
            <img src={qrUrl} alt="Referral QR" width={120} height={120} className="rounded-lg border border-border/60" />
          </div>
        </Card>

        {/* Tables */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-foreground">Recent referrals</h3>
            <div className="mt-3 space-y-2 text-sm">
              {referrals.length === 0 ? (
                <p className="text-xs text-muted-foreground">No referrals yet — share your link to get started.</p>
              ) : referrals.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2">
                  <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</span>
                  <span className="rounded-full bg-background px-2 py-0.5 text-xs font-medium capitalize">{r.status}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="text-sm font-semibold text-foreground">Commission history</h3>
            <div className="mt-3 space-y-2 text-sm">
              {commissions.length === 0 ? (
                <p className="text-xs text-muted-foreground">No commissions yet.</p>
              ) : commissions.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2">
                  <div>
                    <p className="text-sm font-semibold text-foreground">₹{Number(c.commission_amount).toLocaleString("en-IN")}</p>
                    <p className="text-xs text-muted-foreground">{c.percentage}% of ₹{Number(c.amount_paid).toLocaleString("en-IN")}</p>
                  </div>
                  <span className="rounded-full bg-background px-2 py-0.5 text-xs font-medium capitalize">{c.status}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
