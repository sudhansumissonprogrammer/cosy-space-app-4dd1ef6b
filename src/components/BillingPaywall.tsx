import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, Loader2, LogOut } from "lucide-react";
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

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="p-6 space-y-5 text-center">
          <div className="mx-auto h-14 w-14 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="h-7 w-7 text-destructive" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Your store is suspended</h1>
            <p className="text-sm text-muted-foreground mt-2">
              Your subscription payment is overdue. Pay now to reactivate immediately — your products, orders, and settings are safe.
            </p>
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
            Pay ₹{state.price} & Reactivate
          </Button>
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
