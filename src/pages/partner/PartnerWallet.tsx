import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Wallet, Clock, CheckCircle2, TrendingDown, ArrowRight } from "lucide-react";

interface WalletData {
  pending: number; approved: number; locked: number; paid: number; withdrawable: number;
}

export default function PartnerWallet() {
  const [data, setData] = useState<{ wallet: WalletData; ledger: any[]; settings: any } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: res } = await supabase.functions.invoke("partner-wallet", { body: {} });
      if (res) setData(res);
      setLoading(false);
    })();
  }, []);

  if (loading || !data) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-foreground" /></div>;
  }

  const { wallet, ledger, settings } = data;
  const fmt = (n: number) => `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

  const tiles = [
    { label: "Pending", value: wallet.pending, sub: `Hold period: ${settings.hold_days} days`, icon: Clock, color: "bg-bauhaus-yellow", text: "text-foreground" },
    { label: "Approved", value: wallet.approved, sub: "Available to withdraw", icon: CheckCircle2, color: "bg-bauhaus-blue", text: "text-primary-foreground" },
    { label: "Locked", value: wallet.locked, sub: "In an open withdrawal", icon: TrendingDown, color: "bg-bauhaus-white", text: "text-foreground" },
    { label: "Paid out", value: wallet.paid, sub: "Total received", icon: Wallet, color: "bg-bauhaus-canvas", text: "text-foreground" },
  ];

  return (
    <>
      {/* Hero balance card */}
      <div className="bg-bauhaus-red text-primary-foreground border-3 border-foreground shadow-bauhaus-lg p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5">
          <div>
            <div className="inline-block border-2 border-primary-foreground/30 bg-bauhaus-yellow text-foreground px-2 py-0.5 font-bold uppercase tracking-widest text-[10px] mb-3">
              Withdrawable
            </div>
            <p className="font-black text-5xl sm:text-6xl tabular-nums tracking-tight">{fmt(wallet.withdrawable)}</p>
            <p className="mt-2 font-medium text-xs opacity-90">Minimum withdrawal: <span className="font-bold">{fmt(settings.minimum_withdrawal)}</span></p>
          </div>
          <Link
            to="/partners/dashboard/withdrawals"
            className="inline-flex items-center justify-center gap-2 bg-bauhaus-white text-foreground font-bold uppercase tracking-wider text-xs px-6 py-3 border-2 border-foreground shadow-bauhaus hover:bg-bauhaus-yellow active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
          >
            Withdraw <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* Buckets */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className={`${t.color} border-3 border-foreground shadow-bauhaus p-5 ${t.text}`}>
            <div className="flex items-center justify-between">
              <p className={`font-bold uppercase tracking-widest text-[10px] ${t.text === "text-primary-foreground" ? "opacity-80" : "text-muted-foreground"}`}>{t.label}</p>
              <t.icon className="h-4 w-4" />
            </div>
            <p className="mt-3 font-black text-2xl sm:text-3xl tabular-nums">{fmt(t.value)}</p>
            <p className={`mt-1 font-medium text-[11px] ${t.text === "text-primary-foreground" ? "opacity-80" : "text-muted-foreground"}`}>{t.sub}</p>
          </div>
        ))}
      </div>

      {/* Ledger */}
      <div className="bg-bauhaus-white border-3 border-foreground shadow-bauhaus p-5">
        <h3 className="font-black uppercase tracking-wider text-sm text-foreground mb-3">Wallet Activity</h3>

        {ledger.length === 0 ? (
          <p className="py-6 text-center font-medium text-xs text-muted-foreground">No activity yet.</p>
        ) : (
          <div className="divide-y-2 divide-foreground/10">
            {ledger.map((l: any) => (
              <div key={l.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <div className="flex-1 min-w-0">
                  <p className="font-bold uppercase tracking-wider text-xs text-foreground">
                    {String(l.kind).replace(/_/g, " ")}
                  </p>
                  <p className="font-medium text-[11px] text-muted-foreground truncate">
                    {l.notes || "—"} · {new Date(l.created_at).toLocaleString("en-IN")}
                  </p>
                </div>
                <p className={`font-black text-sm tabular-nums px-2 py-0.5 border-2 border-foreground ${l.direction === "credit" ? "bg-bauhaus-yellow" : "bg-bauhaus-red text-primary-foreground"}`}>
                  {l.direction === "credit" ? "+" : "−"}{fmt(Number(l.amount))}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
