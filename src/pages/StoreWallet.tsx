import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDashboardStore } from "@/contexts/DashboardStoreContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Wallet, Plus, ArrowDownCircle, ArrowUpCircle, Loader2 } from "lucide-react";

declare global { interface Window { Cashfree?: any } }

async function loadCashfree(): Promise<any> {
  if (window.Cashfree) return window.Cashfree;
  await new Promise<void>((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
    s.onload = () => res();
    s.onerror = () => rej(new Error("Cashfree SDK failed"));
    document.head.appendChild(s);
  });
  return (window as any).Cashfree;
}

export default function StoreWallet() {
  const { store, storeId } = useDashboardStore();
  const qc = useQueryClient();
  const [rechargeOpen, setRechargeOpen] = useState(false);
  const [amount, setAmount] = useState<string>("700");
  const [busy, setBusy] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["store-wallet", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_store_wallet_summary", { _store_id: storeId! });
      if (error) throw error;
      return data as any;
    },
  });

  // Poll for verify after returning from Cashfree
  useEffect(() => {
    const url = new URL(window.location.href);
    const pendingOrder = url.searchParams.get("wallet_order");
    if (!pendingOrder) return;
    url.searchParams.delete("wallet_order");
    window.history.replaceState({}, "", url.toString());
    (async () => {
      const { data } = await supabase.functions.invoke("wallet-cashfree-verify", {
        body: { order_id: pendingOrder },
      });
      if ((data as any)?.status === "paid") {
        toast({ title: "Recharge successful", description: "Wallet credited." });
        qc.invalidateQueries({ queryKey: ["store-wallet"] });
      } else {
        toast({ title: "Payment pending", description: "We'll update your balance shortly." });
      }
    })();
  }, [qc]);

  if (!storeId) return null;
  const isCommission = (data as any)?.billing_mode === "commission";

  if (!isLoading && !isCommission) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          Wallet is only available for commission-billing stores. Contact support to switch.
        </CardContent>
      </Card>
    );
  }

  const wallet = (data as any)?.wallet ?? { balance: 0, total_recharged: 0, total_charged: 0 };
  const config = (data as any)?.config ?? { commission_percentage: 3, min_recharge: 700, low_balance_threshold: 100 };
  const ledger: any[] = (data as any)?.ledger ?? [];
  const balanceNum = Number(wallet.balance);
  const isNegative = balanceNum < 0;
  const lowBalance = !isNegative && balanceNum < Number(config.low_balance_threshold);

  const handleRecharge = async () => {
    const n = Number(amount);
    if (!Number.isFinite(n) || n < Number(config.min_recharge)) {
      toast({ title: "Invalid amount", description: `Minimum ₹${config.min_recharge}`, variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const { data: res, error } = await supabase.functions.invoke("wallet-cashfree-create-order", {
        body: { store_id: storeId, amount: n },
      });
      if (error || (res as any)?.error) throw new Error((res as any)?.error || error?.message);
      const sessionId = (res as any).payment_session_id;
      const orderId = (res as any).order_id;
      const Cashfree = await loadCashfree();
      const cf = Cashfree({ mode: "production" });
      await cf.checkout({
        paymentSessionId: sessionId,
        redirectTarget: "_self",
        returnUrl: `${window.location.origin}${window.location.pathname}?wallet_order=${orderId}`,
      });
    } catch (e: any) {
      toast({ title: "Recharge failed", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
      setRechargeOpen(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight">Wallet</h1>
        <Button size="sm" onClick={() => setRechargeOpen(true)} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Recharge
        </Button>
      </div>

      <Card>
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Wallet className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs uppercase font-semibold text-muted-foreground tracking-wide">
                {isNegative ? "Outstanding Dues" : "Balance"}
              </p>
              <p className={`text-3xl font-bold tabular-nums ${isNegative ? "text-destructive" : ""}`}>
                {isNegative ? "−" : ""}₹{Math.abs(balanceNum).toFixed(2)}
              </p>
            </div>
            {isNegative ? (
              <Badge variant="destructive" className="ml-auto">Recharge required</Badge>
            ) : lowBalance ? (
              <Badge variant="destructive" className="ml-auto">Low balance</Badge>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
            <div className="rounded-lg border p-3">
              <p className="text-muted-foreground">Total recharged</p>
              <p className="text-base font-bold tabular-nums">₹{Number(wallet.total_recharged).toFixed(2)}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-muted-foreground">Total commission paid</p>
              <p className="text-base font-bold tabular-nums">₹{Number(wallet.total_charged).toFixed(2)}</p>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground pt-1">
            Commission: <span className="font-semibold">{config.commission_percentage}%</span> per
            confirmed/shipped/delivered order · Min recharge ₹{config.min_recharge}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <p className="text-sm font-bold mb-3">Recent activity</p>
          {ledger.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">No transactions yet</p>
          ) : (
            <div className="space-y-2">
              {ledger.slice(0, 30).map((l: any) => (
                <div key={l.id} className="flex items-center gap-3 border-b pb-2 last:border-0">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full ${l.direction === "credit" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                    {l.direction === "credit" ? <ArrowDownCircle className="h-4 w-4" /> : <ArrowUpCircle className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate">{l.notes || l.kind}</p>
                    <p className="text-[10px] text-muted-foreground">{new Date(l.created_at).toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-bold tabular-nums ${l.direction === "credit" ? "text-emerald-600" : "text-rose-600"}`}>
                      {l.direction === "credit" ? "+" : "−"}₹{Number(l.amount).toFixed(2)}
                    </p>
                    <p className="text-[10px] text-muted-foreground tabular-nums">bal ₹{Number(l.balance_after).toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={rechargeOpen} onOpenChange={setRechargeOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Recharge wallet</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <label className="text-xs font-semibold text-muted-foreground">Amount (₹)</label>
            <Input type="number" min={config.min_recharge} value={amount} onChange={(e) => setAmount(e.target.value)} />
            <p className="text-[11px] text-muted-foreground">
              Minimum ₹{config.min_recharge}. Payment via Cashfree (UPI / cards / netbanking).
            </p>
            <div className="flex gap-2">
              {[700, 1500, 3000, 5000].map((v) => (
                <Button key={v} variant="outline" size="sm" type="button" onClick={() => setAmount(String(v))}>₹{v}</Button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRechargeOpen(false)}>Cancel</Button>
            <Button onClick={handleRecharge} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Pay"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
