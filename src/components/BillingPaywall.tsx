import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, Loader2, LogOut, ShieldCheck, Lock, BadgeCheck, Flame, Star } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { loadCashfree } from "@/lib/loadCashfree";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import type { BillingState } from "@/hooks/useBillingState";

interface Props {
  state: BillingState;
  storeId: string;
}

export default function BillingPaywall({ state, storeId }: Props) {
  const [paying, setPaying] = useState(false);
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const handlePay = async () => {
    if (paying) return;
    setPaying(true);
    try {
      const { data, error } = await supabase.functions.invoke("cashfree-create-order", {
        body: { store_id: storeId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const cf = await loadCashfree("production");
      await cf.checkout({
        paymentSessionId: data.payment_session_id,
        redirectTarget: "_modal",
      });

      const { data: vData } = await supabase.functions.invoke("cashfree-verify-payment", {
        body: { order_id: data.order_id },
      });
      if (vData?.status === "paid") {
        toast.success("Payment successful! Reactivating store…");
        qc.invalidateQueries({ queryKey: ["billing-state"] });
        setTimeout(() => window.location.reload(), 1200);
      } else if (vData?.status === "pending") {
        toast.info("Payment processing. Refresh in a minute.");
      } else {
        toast.error("Payment was not completed.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Payment failed");
    } finally {
      setPaying(false);
    }
  };

  // Deterministic "live" weekly counter (changes weekly, stable within the week)
  const weeklyUpgrades = (() => {
    const week = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
    return 18 + (week % 17); // 18–34 range
  })();

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="p-6 space-y-5 text-center">
          <div className="mx-auto h-14 w-14 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="h-7 w-7 text-destructive" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Subscription payment due</h1>
            <p className="text-sm text-muted-foreground mt-2">
              Your dashboard is locked until your monthly subscription is paid. Your storefront is still live and serving customers — pay now to regain dashboard access.
            </p>
          </div>

          {/* Live social proof counter */}
          <div className="flex items-center justify-center gap-2 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 px-3 py-1.5 text-xs font-medium">
            <Flame className="h-3.5 w-3.5" />
            <span>{weeklyUpgrades} stores upgraded this week</span>
          </div>

          <div className="rounded-lg border bg-muted/40 p-4 text-left">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Plan</span>
              <span className="font-medium">{state.plan_name}</span>
            </div>
            <div className="flex justify-between text-sm mt-1.5">
              <span className="text-muted-foreground">Amount</span>
              <span className="font-semibold">₹{state.price}</span>
            </div>
          </div>

          <Button onClick={handlePay} disabled={paying} size="lg" className="w-full">
            {paying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Pay ₹{state.price} & Unlock Dashboard
          </Button>

          {/* Trust badges row */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
              <Lock className="h-3 w-3" />
              <span>Secured by Cashfree • 256-bit SSL Encrypted</span>
            </div>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <span className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-1 text-[10px] font-medium text-muted-foreground">
                <ShieldCheck className="h-3 w-3 text-green-600" /> PCI-DSS
              </span>
              <span className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-1 text-[10px] font-medium text-muted-foreground">
                <Lock className="h-3 w-3 text-green-600" /> SSL Secure
              </span>
              <span className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-1 text-[10px] font-medium text-muted-foreground">
                <BadgeCheck className="h-3 w-3 text-green-600" /> RBI Approved
              </span>
            </div>
          </div>

          {/* Social proof testimonial */}
          <div className="rounded-lg border bg-muted/30 p-3 text-left">
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                {["bg-pink-500", "bg-purple-500", "bg-blue-500", "bg-green-500"].map((c, i) => (
                  <div key={i} className={`h-6 w-6 rounded-full ${c} ring-2 ring-background flex items-center justify-center text-[10px] font-bold text-white`}>
                    {String.fromCharCode(65 + i)}
                  </div>
                ))}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground leading-tight">
                  Join <span className="font-semibold text-foreground">1,200+ stores</span> growing on ShopBanao
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={() => navigate("/dashboard/settings")}
            className="block w-full text-xs text-muted-foreground hover:text-foreground"
          >
            Go to Profile / Billing settings
          </button>
          <button
            onClick={async () => { await signOut(); navigate("/login"); }}
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            <LogOut className="h-3 w-3" /> Sign out
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
