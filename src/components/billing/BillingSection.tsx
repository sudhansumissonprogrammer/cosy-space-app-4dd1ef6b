import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Crown, Loader2, AlertTriangle, Clock, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { loadCashfree } from "@/lib/loadCashfree";
import { useBillingState } from "@/hooks/useBillingState";

export default function BillingSection({ storeId }: { storeId: string | null }) {
  const queryClient = useQueryClient();
  const [paying, setPaying] = useState(false);

  const { data: state, isLoading, refetch } = useBillingState(storeId);

  const { data: payments } = useQuery({
    queryKey: ["sub-payments", storeId],
    queryFn: async () => {
      if (!storeId) return [];
      const { data } = await supabase
        .from("subscription_payments")
        .select("id, amount, currency, status, paid_at, created_at, period_end")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(5);
      return data || [];
    },
    enabled: !!storeId,
  });

  if (!storeId) return null;
  if (isLoading) {
    return (
      <Card><CardContent className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></CardContent></Card>
    );
  }
  if (!state) return null;

  const handlePay = async () => {
    if (paying) return;
    setPaying(true);
    try {
      const { data, error } = await supabase.functions.invoke("cashfree-create-order", {
        body: { store_id: storeId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.payment_session_id) throw new Error("No payment session");

      const cf = await loadCashfree("production");
      await cf.checkout({
        paymentSessionId: data.payment_session_id,
        redirectTarget: "_modal",
      });

      // Verify after modal closes
      const { data: verifyData, error: vErr } = await supabase.functions.invoke("cashfree-verify-payment", {
        body: { order_id: data.order_id },
      });
      if (vErr) throw vErr;

      if (verifyData?.status === "paid") {
        toast.success("Payment successful! Your store is active.");
        queryClient.invalidateQueries({ queryKey: ["billing-state"] });
        queryClient.invalidateQueries({ queryKey: ["sub-payments"] });
        refetch();
      } else if (verifyData?.status === "pending") {
        toast.info("Payment is processing. Refresh in a minute.");
      } else {
        toast.error("Payment was not completed.");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Payment failed");
    } finally {
      setPaying(false);
    }
  };

  const statusBadge = () => {
    if (state.is_free_lifetime) return <Badge variant="default">Lifetime</Badge>;
    if (state.is_one_time && state.billing_status === "one_time_paid") return <Badge variant="default">One-Time Paid</Badge>;
    switch (state.billing_status) {
      case "trialing": return <Badge variant="secondary">Free Trial</Badge>;
      case "active": return <Badge variant="default">Active</Badge>;
      case "past_due": return <Badge variant="destructive">Payment Due</Badge>;
      case "suspended": return <Badge variant="destructive">Suspended</Badge>;
      default: return <Badge variant="outline">{state.billing_status}</Badge>;
    }
  };

  const renderAlert = () => {
    if (!state.requires_payment && !state.is_suspended) return null;

    if (state.billing_status === "suspended") {
      return (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
            <div>
              <p className="font-medium text-destructive">Your store is suspended</p>
              <p className="text-muted-foreground mt-1">Pay now to reactivate immediately.</p>
            </div>
          </div>
        </div>
      );
    }
    if (state.billing_status === "past_due") {
      return (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
            <div>
              <p className="font-medium text-destructive">
                Grace period — {state.days_until_action ?? 0} day{state.days_until_action === 1 ? "" : "s"} left
              </p>
              <p className="text-muted-foreground mt-1">Pay before grace ends to avoid suspension.</p>
            </div>
          </div>
        </div>
      );
    }
    if (state.billing_status === "trialing") {
      const days = state.days_until_action ?? 0;
      return (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <div className="flex items-start gap-2">
            <Clock className="h-4 w-4 text-amber-600 mt-0.5" />
            <div>
              <p className="font-medium text-amber-700 dark:text-amber-500">
                Free trial — {days} day{days === 1 ? "" : "s"} left
              </p>
              <p className="text-muted-foreground mt-1">Pay anytime to start your monthly cycle.</p>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Crown className="h-4 w-4 text-primary" />
          Billing & Subscription
        </CardTitle>
        <CardDescription>Manage your monthly plan</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-foreground">{state.plan_name}</p>
            <p className="text-sm text-muted-foreground">
              {state.is_free_lifetime
                ? "Free forever — Unlimited"
                : state.is_one_time
                ? `₹${state.price} one-time`
                : `₹${state.price}/mo`}
            </p>
          </div>
          {statusBadge()}
        </div>

        {renderAlert()}

        {state.billing_status === "active" && state.current_period_end && (
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
            Renews on {new Date(state.current_period_end).toLocaleDateString()}
          </div>
        )}

        {state.requires_payment && (
          <Button onClick={handlePay} disabled={paying} className="w-full">
            {paying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {state.billing_status === "suspended" ? "Pay & Reactivate" : `Pay ₹${state.price} Now`}
          </Button>
        )}

        {payments && payments.length > 0 && (
          <div className="pt-2 border-t">
            <p className="text-xs font-medium text-muted-foreground mb-2">Recent Payments</p>
            <div className="space-y-1.5">
              {payments.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {new Date(p.paid_at || p.created_at).toLocaleDateString()}
                  </span>
                  <span className="font-medium">₹{p.amount}</span>
                  <Badge variant={p.status === "paid" ? "default" : p.status === "failed" ? "destructive" : "secondary"} className="text-[10px] px-1.5 py-0">
                    {p.status}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
