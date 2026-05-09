import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Copy, Share2, IndianRupee, Users, MousePointerClick, CheckCircle2,
  TrendingUp, Sparkles, Link2,
} from "lucide-react";
import { toast } from "sonner";
import { buildReferralLink } from "@/lib/referralTracking";
import { StatTile } from "@/components/partner/StatTile";
import { useCountUp } from "@/hooks/useCountUp";

export default function PartnerOverview() {
  const { partner } = useOutletContext<{ partner: any }>();
  const [stats, setStats] = useState<any>(null);
  const [referrals, setReferrals] = useState<any[]>([]);
  const [commissions, setCommissions] = useState<any[]>([]);

  const refresh = async () => {
    const { data: statsRes } = await supabase.functions.invoke("partner-stats", { body: {} });
    if (statsRes?.stats) setStats(statsRes.stats);
    const [{ data: refs }, { data: comms }] = await Promise.all([
      supabase.from("partner_referrals").select("id,status,created_at,first_paid_at").eq("partner_id", partner.id).order("created_at", { ascending: false }).limit(10),
      supabase.from("partner_commissions").select("id,amount_paid,commission_amount,percentage,status,created_at").eq("partner_id", partner.id).order("created_at", { ascending: false }).limit(10),
    ]);
    setReferrals(refs || []);
    setCommissions(comms || []);
  };

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partner.id]);

  const refLink = buildReferralLink(partner.partner_code);
  const copy = async (text: string, label = "Copied!") => {
    try { await navigator.clipboard.writeText(text); toast.success(label); } catch { toast.error("Copy failed"); }
  };
  const shareWhatsApp = () => {
    const msg = encodeURIComponent(`Build your online store on ShopBanao — ${refLink}`);
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  };
  const nativeShare = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: "ShopBanao", text: "Build your online store", url: refLink }); }
      catch {}
    } else {
      copy(refLink, "Link copied!");
    }
  };
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(refLink)}`;

  const totalEarned = stats?.totalEarned ?? 0;
  const earnedAnimated = useCountUp(totalEarned);
  const conversion = useMemo(() => {
    const c = stats?.clicks ?? 0;
    const s = stats?.signups ?? 0;
    if (!c) return 0;
    return Math.round((s / c) * 100);
  }, [stats]);

  return (
    <>
      {/* Hero earnings */}
      <Card className="overflow-hidden rounded-2xl border-0 bg-gradient-to-br from-primary via-primary to-primary/70 p-5 text-primary-foreground shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider opacity-90">
              <Sparkles className="h-3 w-3" /> Total earned
            </div>
            <p className="mt-1.5 text-3xl font-bold tabular-nums sm:text-4xl">
              ₹{earnedAnimated.toLocaleString("en-IN")}
            </p>
            <p className="mt-1 text-xs opacity-80">
              Earning <span className="font-semibold">{partner.commission_percentage}%</span> recurring on every payment
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-2">
            <Button size="sm" variant="secondary" onClick={shareWhatsApp} className="h-8 gap-1.5 text-xs">
              <Share2 className="h-3.5 w-3.5" /> Share
            </Button>
            <Button size="sm" variant="outline" onClick={() => copy(refLink, "Link copied!")} className="h-8 gap-1.5 border-white/30 bg-white/10 text-xs text-primary-foreground hover:bg-white/20 hover:text-primary-foreground">
              <Copy className="h-3.5 w-3.5" /> Copy
            </Button>
          </div>
        </div>
      </Card>

      {/* Stat strip */}
      <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-hide md:grid md:grid-cols-4 md:overflow-visible">
        <StatTile label="Clicks" value={stats?.clicks ?? 0} icon={MousePointerClick} tone="text-blue-600" />
        <StatTile label="Signups" value={stats?.signups ?? 0} icon={Users} tone="text-purple-600" />
        <StatTile label="Paid" value={stats?.paid ?? 0} icon={CheckCircle2} tone="text-emerald-600" />
        <StatTile label="Conversion" value={`${conversion}%`} icon={TrendingUp} tone="text-amber-600" animated={false} />
      </div>

      {/* Referral link card */}
      <Card className="rounded-2xl border p-5 shadow-none">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Link2 className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-bold tracking-tight text-foreground">Your referral link</h3>
          </div>
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            Active
          </span>
        </div>

        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-2 rounded-xl border bg-accent/20 p-2">
              <Input readOnly value={refLink} className="h-8 flex-1 border-0 bg-transparent font-mono text-xs shadow-none focus-visible:ring-0" />
              <Button size="sm" variant="ghost" onClick={() => copy(refLink, "Link copied!")} className="h-8 gap-1 px-2 text-xs">
                <Copy className="h-3.5 w-3.5" /> Copy
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={shareWhatsApp} className="h-8 gap-1.5 text-xs">
                <Share2 className="h-3.5 w-3.5" /> WhatsApp
              </Button>
              <Button size="sm" variant="outline" onClick={nativeShare} className="h-8 gap-1.5 text-xs">
                <Share2 className="h-3.5 w-3.5" /> Share
              </Button>
              <Button size="sm" variant="outline" onClick={() => copy(partner.partner_code, "Code copied!")} className="h-8 gap-1.5 font-mono text-xs">
                {partner.partner_code}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Share with creators, agencies and shop owners. You earn every billing cycle they stay subscribed.
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-center gap-1.5 rounded-xl border bg-muted/30 p-3">
            <img src={qrUrl} alt="Referral QR" width={120} height={120} className="rounded-lg" loading="lazy" />
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Scan to share</p>
          </div>
        </div>
      </Card>

      {/* Recent activity */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl border p-5 shadow-none">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold tracking-tight text-foreground">Recent referrals</h3>
            <span className="text-[11px] text-muted-foreground">{referrals.length} shown</span>
          </div>
          <div className="mt-3 space-y-2">
            {referrals.length === 0 ? (
              <EmptyState icon={Users} text="No referrals yet — share your link to get started." />
            ) : referrals.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-xl bg-muted/30 px-3 py-2.5 transition-colors hover:bg-muted/50">
                <div>
                  <p className="text-xs font-medium text-foreground">
                    {new Date(r.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                  {r.first_paid_at && (
                    <p className="text-[11px] text-emerald-600">Paid on {new Date(r.first_paid_at).toLocaleDateString()}</p>
                  )}
                </div>
                <StatusPill status={r.status} />
              </div>
            ))}
          </div>
        </Card>

        <Card className="rounded-2xl border p-5 shadow-none">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold tracking-tight text-foreground">Commission history</h3>
            <span className="text-[11px] text-muted-foreground">{commissions.length} shown</span>
          </div>
          <div className="mt-3 space-y-2">
            {commissions.length === 0 ? (
              <EmptyState icon={IndianRupee} text="No commissions yet." />
            ) : commissions.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-xl bg-muted/30 px-3 py-2.5 transition-colors hover:bg-muted/50">
                <div>
                  <p className="text-sm font-bold tabular-nums text-foreground">
                    ₹{Number(c.commission_amount).toLocaleString("en-IN")}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {c.percentage}% of ₹{Number(c.amount_paid).toLocaleString("en-IN")}
                  </p>
                </div>
                <StatusPill status={c.status} />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}

function EmptyState({ icon: Icon, text }: { icon: any; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-xs text-muted-foreground">{text}</p>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const tone: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    approved: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    locked: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
    refunded: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
    rejected: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
    cancelled: "bg-muted text-muted-foreground",
  };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tone[status] || "bg-muted text-muted-foreground"}`}>
      {status}
    </span>
  );
}
