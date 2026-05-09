import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Loader2, Wallet, Clock, CheckCircle2, TrendingDown, ArrowRight, ArrowUpRight, ArrowDownLeft,
} from "lucide-react";
import { StatTile } from "@/components/partner/StatTile";
import { useCountUp } from "@/hooks/useCountUp";

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

  const withdrawable = data?.wallet.withdrawable ?? 0;
  const animated = useCountUp(withdrawable);

  if (loading || !data) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  const { wallet, ledger, settings } = data;
  const fmt = (n: number) => `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

  // Progress: how much of total (pending + approved) is approved
  const total = wallet.pending + wallet.approved;
  const approvedPct = total > 0 ? Math.round((wallet.approved / total) * 100) : 0;

  const tiles = [
    { label: "Pending", value: wallet.pending, sub: `Hold: ${settings.hold_days}d`, icon: Clock, tone: "text-amber-600" },
    { label: "Approved", value: wallet.approved, sub: "Withdrawable", icon: CheckCircle2, tone: "text-emerald-600" },
    { label: "Locked", value: wallet.locked, sub: "In withdrawal", icon: TrendingDown, tone: "text-blue-600" },
    { label: "Paid out", value: wallet.paid, sub: "Total received", icon: Wallet, tone: "text-purple-600" },
  ];

  return (
    <>
      {/* Hero withdrawable */}
      <Card className="overflow-hidden rounded-2xl border-0 bg-gradient-to-br from-primary via-primary to-primary/70 p-5 text-primary-foreground shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wider opacity-90">Withdrawable balance</p>
            <p className="mt-1.5 text-3xl font-bold tabular-nums sm:text-4xl">
              ₹{animated.toLocaleString("en-IN")}
            </p>
            <p className="mt-1 text-xs opacity-80">Minimum withdrawal: {fmt(settings.minimum_withdrawal)}</p>
          </div>
          <Button asChild size="sm" variant="secondary" className="h-9 gap-1 px-3">
            <Link to="/partners/dashboard/withdrawals">
              Withdraw <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>

        {/* Progress bar */}
        {total > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-[11px] opacity-90">
              <span>Pending → Approved</span>
              <span className="font-semibold">{approvedPct}%</span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full bg-white transition-all duration-700"
                style={{ width: `${approvedPct}%` }}
              />
            </div>
          </div>
        )}
      </Card>

      {/* Tiles */}
      <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-hide md:grid md:grid-cols-4 md:overflow-visible">
        {tiles.map((t) => (
          <StatTile key={t.label} label={t.label} value={t.value} icon={t.icon} tone={t.tone} sub={t.sub} prefix="₹" />
        ))}
      </div>

      {/* Activity */}
      <Card className="rounded-2xl border p-5 shadow-none">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold tracking-tight text-foreground">Wallet activity</h3>
          <span className="text-[11px] text-muted-foreground">{ledger.length} entries</span>
        </div>
        <div className="mt-3 divide-y divide-border/50">
          {ledger.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                <Wallet className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-xs text-muted-foreground">No activity yet.</p>
            </div>
          ) : ledger.map((l: any) => {
            const isCredit = l.direction === "credit";
            return (
              <div key={l.id} className="flex items-center gap-3 py-3">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                  isCredit ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-950" : "bg-rose-100 text-rose-600 dark:bg-rose-950"
                }`}>
                  {isCredit ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium capitalize text-foreground">
                    {String(l.kind).replace(/_/g, " ")}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {l.notes || new Date(l.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
                <p className={`shrink-0 text-sm font-bold tabular-nums ${isCredit ? "text-emerald-600" : "text-rose-600"}`}>
                  {isCredit ? "+" : "−"}{fmt(Number(l.amount))}
                </p>
              </div>
            );
          })}
        </div>
      </Card>
    </>
  );
}
