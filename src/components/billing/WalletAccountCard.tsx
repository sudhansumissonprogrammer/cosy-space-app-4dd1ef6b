import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Wallet, Plus, Loader2 } from "lucide-react";

declare global {
  interface Window {
    Cashfree?: any;
  }
}

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

interface Props {
  storeId: string;
  storeSlug?: string | null;
  /** "compact" hides the "View full history" link (used on the Wallet page itself). */
  variant?: "compact" | "full";
}

/**
 * Shared wallet balance + recharge card.
 * Used on the Account settings page (commission stores only) and on the
 * dedicated Wallet page. All data + recharge flow lives here so behaviour
 * stays in sync.
 */
export default function WalletAccountCard({ storeId, storeSlug, variant = "compact" }: Props) {
  const qc = useQueryClient();
  const [rechargeOpen, setRechargeOpen] = useState(false);
  const [amount, setAmount] = useState<string>("700");
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["store-wallet", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_store_wallet_summary", {
        _store_id: storeId,
      });
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

  if (isLoading || !data) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const wallet = (data as any)?.wallet ?? { balance: 0, total_recharged: 0, total_charged: 0 };
  const config =
    (data as any)?.config ?? {
      commission_percentage: 3,
      min_recharge: 700,
      low_balance_threshold: 100,
    };
  const balanceNum = Number(wallet.balance);
  const isNegative = balanceNum < 0;
  const lowBalance = !isNegative && balanceNum < Number(config.low_balance_threshold);

  const handleRecharge = async () => {
    const n = Number(amount);
    if (!Number.isFinite(n) || n < Number(config.min_recharge)) {
      toast({
        title: "Invalid amount",
        description: `Minimum ₹${config.min_recharge}`,
        variant: "destructive",
      });
      return;
    }
    setBusy(true);
    try {
      const { data: res, error } = await supabase.functions.invoke(
        "wallet-cashfree-create-order",
        { body: { store_id: storeId, amount: n } },
      );
      if (error || (res as any)?.error)
        throw new Error((res as any)?.error || error?.message);
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
    <>
      <Card>
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Wallet className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs uppercase font-semibold text-muted-foreground tracking-wide">
                {isNegative ? "Outstanding Dues" : "Wallet Balance"}
              </p>
              <p
                className={`text-3xl font-bold tabular-nums ${isNegative ? "text-destructive" : ""}`}
              >
                {isNegative ? "−" : ""}₹{Math.abs(balanceNum).toFixed(2)}
              </p>
            </div>
            {isNegative ? (
              <Badge variant="destructive">Recharge required</Badge>
            ) : lowBalance ? (
              <Badge variant="destructive">Low balance</Badge>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
            <div className="rounded-lg border p-3">
              <p className="text-muted-foreground">Total recharged</p>
              <p className="text-base font-bold tabular-nums">
                ₹{Number(wallet.total_recharged).toFixed(2)}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-muted-foreground">Total commission paid</p>
              <p className="text-base font-bold tabular-nums">
                ₹{Number(wallet.total_charged).toFixed(2)}
              </p>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground pt-1">
            Commission:{" "}
            <span className="font-semibold">{config.commission_percentage}%</span> per
            confirmed/shipped/delivered order · Min recharge ₹{config.min_recharge}
          </p>

          <div className="flex items-center gap-2 pt-1">
            <Button size="sm" onClick={() => setRechargeOpen(true)} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Recharge wallet
            </Button>
            {variant === "compact" && storeSlug && (
              <Button asChild size="sm" variant="outline">
                <Link to={`/dashboard/stores/${storeSlug}/wallet`}>View full history</Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={rechargeOpen} onOpenChange={setRechargeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recharge wallet</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <label className="text-xs font-semibold text-muted-foreground">Amount (₹)</label>
            <Input
              type="number"
              min={config.min_recharge}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">
              Minimum ₹{config.min_recharge}. Payment via Cashfree (UPI / cards / netbanking).
            </p>
            <div className="flex gap-2">
              {[700, 1500, 3000, 5000].map((v) => (
                <Button
                  key={v}
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => setAmount(String(v))}
                >
                  ₹{v}
                </Button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRechargeOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRecharge} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Pay"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
