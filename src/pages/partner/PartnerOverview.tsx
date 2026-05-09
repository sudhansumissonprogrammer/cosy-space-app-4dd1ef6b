import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Copy, Share2, IndianRupee, Users, MousePointerClick, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { buildReferralLink } from "@/lib/referralTracking";

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
  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); toast.success("Copied!"); } catch { toast.error("Copy failed"); }
  };
  const shareWhatsApp = () => {
    const msg = encodeURIComponent(`Build your online store on ShopBanao — ${refLink}`);
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  };
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(refLink)}`;

  const tiles = [
    { label: "Clicks", value: stats?.clicks ?? 0, icon: MousePointerClick, color: "bg-bauhaus-yellow" },
    { label: "Signups", value: stats?.signups ?? 0, icon: Users, color: "bg-bauhaus-blue", text: "text-primary-foreground" },
    { label: "Paid customers", value: stats?.paid ?? 0, icon: CheckCircle2, color: "bg-bauhaus-red", text: "text-primary-foreground" },
    { label: "Total earned", value: `₹${(stats?.totalEarned ?? 0).toLocaleString("en-IN")}`, icon: IndianRupee, color: "bg-bauhaus-white" },
  ];

  return (
    <>
      {/* Heading */}
      <div>
        <h1 className="font-black text-2xl sm:text-3xl tracking-tight text-foreground">
          Welcome back, {partner.name?.split(" ")[0] || "Partner"}.
        </h1>
        <p className="mt-1 font-medium text-sm text-muted-foreground">Here's what's happening with your referrals.</p>
      </div>

      {/* Stat tiles */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((s) => (
          <div key={s.label} className={`${s.color} border-3 border-foreground shadow-bauhaus p-5`}>
            <div className="flex items-center justify-between">
              <p className={`font-bold uppercase tracking-widest text-[10px] ${s.text === "text-primary-foreground" ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{s.label}</p>
              <s.icon className={`h-4 w-4 ${s.text || "text-foreground"}`} />
            </div>
            <p className={`mt-3 font-black text-3xl tabular-nums ${s.text || "text-foreground"}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Referral link */}
      <div className="bg-bauhaus-white border-3 border-foreground shadow-bauhaus-lg p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="bg-bauhaus-red text-primary-foreground border-2 border-foreground px-2 py-0.5 font-bold uppercase tracking-widest text-[10px] shadow-bauhaus-sm">
            Your Link
          </div>
          <p className="font-bold uppercase tracking-wider text-sm text-foreground">Share this referral link</p>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex-1 space-y-3">
            <div className="flex gap-2">
              <input
                readOnly
                value={refLink}
                className="flex-1 bg-bauhaus-canvas text-foreground border-2 border-foreground px-3 py-2 font-mono text-xs focus:outline-none"
              />
              <button
                onClick={() => copy(refLink)}
                className="inline-flex items-center gap-1.5 bg-bauhaus-yellow text-foreground font-bold uppercase tracking-wider text-[11px] px-3 py-2 border-2 border-foreground shadow-bauhaus-sm hover:bg-bauhaus-yellow/90 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
              >
                <Copy className="h-3.5 w-3.5" /> Copy
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={shareWhatsApp}
                className="inline-flex items-center gap-1.5 bg-bauhaus-blue text-primary-foreground font-bold uppercase tracking-wider text-[11px] px-3 py-2 border-2 border-foreground shadow-bauhaus-sm hover:bg-bauhaus-blue/90 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
              >
                <Share2 className="h-3.5 w-3.5" /> WhatsApp
              </button>
              <button
                onClick={() => copy(partner.partner_code)}
                className="inline-flex items-center gap-1.5 bg-bauhaus-white text-foreground font-bold uppercase tracking-wider text-[11px] px-3 py-2 border-2 border-foreground shadow-bauhaus-sm hover:bg-muted active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
              >
                Code: <span className="font-mono">{partner.partner_code}</span>
              </button>
            </div>
            <p className="font-medium text-xs text-muted-foreground">
              Earning <span className="font-black text-foreground">{partner.commission_percentage}%</span> recurring on every payment from your referred stores.
            </p>
          </div>

          <div className="bg-bauhaus-white border-3 border-foreground shadow-bauhaus p-2 self-start">
            <img src={qrUrl} alt="Referral QR" width={120} height={120} className="block" />
          </div>
        </div>
      </div>

      {/* Two column lists */}
      <div className="grid gap-5 lg:grid-cols-2">
        <ListCard title="Recent Referrals" emptyText="No referrals yet — share your link to get started.">
          {referrals.map((r) => (
            <div key={r.id} className="flex items-center justify-between border-2 border-foreground bg-bauhaus-canvas px-3 py-2">
              <span className="font-medium text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString("en-IN")}</span>
              <StatusPill status={r.status} />
            </div>
          ))}
        </ListCard>

        <ListCard title="Commission History" emptyText="No commissions yet.">
          {commissions.map((c) => (
            <div key={c.id} className="flex items-center justify-between border-2 border-foreground bg-bauhaus-canvas px-3 py-2">
              <div>
                <p className="font-black text-sm text-foreground tabular-nums">₹{Number(c.commission_amount).toLocaleString("en-IN")}</p>
                <p className="font-medium text-[11px] text-muted-foreground">{c.percentage}% of ₹{Number(c.amount_paid).toLocaleString("en-IN")}</p>
              </div>
              <StatusPill status={c.status} />
            </div>
          ))}
        </ListCard>
      </div>
    </>
  );
}

function ListCard({ title, emptyText, children }: { title: string; emptyText: string; children: React.ReactNode }) {
  const empty = !children || (Array.isArray(children) && children.length === 0);
  return (
    <div className="bg-bauhaus-white border-3 border-foreground shadow-bauhaus p-5">
      <h3 className="font-black uppercase tracking-wider text-sm text-foreground mb-3">{title}</h3>
      {empty ? (
        <p className="font-medium text-xs text-muted-foreground">{emptyText}</p>
      ) : (
        <div className="space-y-2">{children}</div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const tone: Record<string, string> = {
    paid: "bg-bauhaus-yellow",
    approved: "bg-bauhaus-blue text-primary-foreground",
    pending: "bg-bauhaus-white",
    signup: "bg-bauhaus-white",
    locked: "bg-bauhaus-red text-primary-foreground",
  };
  return (
    <span className={`border-2 border-foreground px-2 py-0.5 font-bold uppercase tracking-widest text-[10px] ${tone[status] || "bg-bauhaus-white"}`}>
      {status}
    </span>
  );
}
