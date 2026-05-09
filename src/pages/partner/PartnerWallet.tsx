import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  const { wallet, ledger, settings } = data;
  const fmt = (n: number) => `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

  const tiles = [
    { label: "Pending", value: wallet.pending, sub: `Hold period: ${settings.hold_days} days`, icon: Clock, tone: "text-amber-600" },
    { label: "Approved", value: wallet.approved, sub: "Available to withdraw", icon: CheckCircle2, tone: "text-emerald-600" },
    { label: "Locked", value: wallet.locked, sub: "In an open withdrawal", icon: TrendingDown, tone: "text-blue-600" },
    { label: "Paid out", value: wallet.paid, sub: "Total received", icon: Wallet, tone: "text-foreground" },
  ];

  return (
    <>
      <Card className="overflow-hidden border-0 bg-gradient-to-br from-primary to-primary/70 p-6 text-primary-foreground">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wider opacity-80">Withdrawable balance</p>
            <p className="mt-1 text-4xl font-bold tabular-nums">{fmt(wallet.withdrawable)}</p>
            <p className="mt-1 text-xs opacity-80">Minimum withdrawal: {fmt(settings.minimum_withdrawal)}</p>
          </div>
          <Button asChild variant="secondary" size="sm">
            <Link to="/partners/dashboard/withdrawals">Withdraw <ArrowRight className="ml-1 h-3 w-3" /></Link>
          </Button>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <Card key={t.label} className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">{t.label}</p>
              <t.icon className={`h-4 w-4 ${t.tone}`} />
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums">{fmt(t.value)}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{t.sub}</p>
          </Card>
        ))}
      </div>

      <Card className="p-5">
        <h3 className="text-sm font-semibold text-foreground">Wallet activity</h3>
        <div className="mt-3 divide-y divide-border/50">
          {ledger.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">No activity yet.</p>
          ) : ledger.map((l: any) => (
            <div key={l.id} className="flex items-center justify-between py-3">
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground capitalize">
                  {String(l.kind).replace(/_/g, " ")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {l.notes || "—"} · {new Date(l.created_at).toLocaleString()}
                </p>
              </div>
              <p className={`text-sm font-semibold tabular-nums ${l.direction === "credit" ? "text-emerald-600" : "text-rose-600"}`}>
                {l.direction === "credit" ? "+" : "−"}{fmt(Number(l.amount))}
              </p>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
