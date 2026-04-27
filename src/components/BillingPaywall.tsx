import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, Loader2, LogOut, ShieldCheck, Lock, BadgeCheck, Flame, Star, RefreshCw, CheckCircle2 } from "lucide-react";
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

type PayStage = "idle" | "creating" | "checkout" | "verifying" | "success" | "pending" | "failed" | "cancelled";

export default function BillingPaywall({ state, storeId }: Props) {
  const [stage, setStage] = useState<PayStage>("idle");
  const [statusMsg, setStatusMsg] = useState<string>("");
  const pendingOrderRef = useRef<{ order_id: string; payment_session_id: string } | null>(null);
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  // Preload Cashfree SDK + prewarm edge functions the moment the paywall mounts.
  // By the time the user clicks Pay, SDK is loaded and edge functions are hot → much faster checkout open.
  useEffect(() => {
    // 1. Preload Cashfree JS SDK in background
    loadCashfree("production").catch(() => {});

    // 2. Prewarm edge functions (CORS preflight — no side effects)
    const SUPABASE_FUNCTIONS_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1`;
    const prewarm = (fn: string) => {
      try {
        fetch(`${SUPABASE_FUNCTIONS_URL}/${fn}`, {
          method: "OPTIONS",
          headers: {
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type, authorization",
          },
        }).catch(() => {});
      } catch {}
    };
    prewarm("cashfree-create-order");
    prewarm("cashfree-verify-payment");
  }, []);

  const busy = stage === "creating" || stage === "checkout" || stage === "verifying";

  // Verify a known order with retry — handles network / propagation delay.
  // Schedule: 0.6s, 1.2s, 1.8s, 2.5s, 3.5s, 4.5s, 6s = ~20s total coverage.
  const verifyOrder = async (order_id: string, attempts = 8): Promise<"paid" | "pending" | "failed"> => {
    const delays = [600, 1200, 1800, 2500, 3500, 4500, 6000, 6000];
    for (let i = 0; i < attempts; i++) {
      try {
        const { data, error } = await supabase.functions.invoke("cashfree-verify-payment", {
          body: { order_id },
        });
        if (error) throw error;
        const s = data?.status;
        if (s === "paid") return "paid";
        if (s === "failed" || s === "expired" || s === "cancelled") return "failed";
        // pending → wait & retry (Cashfree may not have finalized yet)
        if (i < attempts - 1) await new Promise((r) => setTimeout(r, delays[i] ?? 3000));
      } catch {
        if (i < attempts - 1) await new Promise((r) => setTimeout(r, delays[i] ?? 3000));
      }
    }
    return "pending";
  };

  const onSuccess = () => {
    setStage("success");
    setStatusMsg("Payment successful! Your dashboard is unlocking…");
    toast.success("Payment successful! Reactivating store…");
    qc.invalidateQueries({ queryKey: ["billing-state"] });
    setTimeout(() => window.location.reload(), 1500);
  };

  // Auto-verify on tab focus / visibility change.
  // Catches the UPI case: user paid in their bank app, came back, but modal was closed.
  useEffect(() => {
    const recheck = async () => {
      const order = pendingOrderRef.current;
      if (!order) return;
      if (stage === "creating" || stage === "checkout" || stage === "verifying" || stage === "success") return;
      setStage("verifying");
      setStatusMsg("Checking payment status…");
      const verdict = await verifyOrder(order.order_id, 2);
      if (verdict === "paid") return onSuccess();
      if (verdict === "failed") {
        pendingOrderRef.current = null;
        setStage("failed");
        setStatusMsg("Payment failed. Please try again.");
        return;
      }
      setStage("pending");
      setStatusMsg("Payment is processing. Tap 'Check status' in a moment.");
    };

    const onVisible = () => { if (document.visibilityState === "visible") recheck(); };
    window.addEventListener("focus", recheck);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", recheck);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  // Open Cashfree for an existing session (initial OR retry)
  const openCashfreeForSession = async (order_id: string, payment_session_id: string) => {
    setStage("checkout");
    setStatusMsg("");
    try {
      const cf = await loadCashfree("production");
      // cf.checkout returns when modal closes (success, failure, or user-dismiss)
      const result = await cf.checkout({
        paymentSessionId: payment_session_id,
        redirectTarget: "_modal",
      }).catch((e: any) => ({ error: e }));

      // Always verify with backend (source of truth) regardless of what SDK reports
      setStage("verifying");
      setStatusMsg("Verifying payment…");
      const verdict = await verifyOrder(order_id);

      if (verdict === "paid") {
        onSuccess();
        return;
      }
      if (verdict === "pending") {
        setStage("pending");
        setStatusMsg("Payment is processing. Tap 'Check status' in a moment.");
        toast.info("Payment processing. We'll confirm shortly.");
        return;
      }
      // failed / cancelled / closed without paying
      const wasError = (result as any)?.error;
      if (wasError) {
        setStage("cancelled");
        setStatusMsg("Checkout closed. You can retry below.");
      } else {
        setStage("failed");
        setStatusMsg("Payment was not completed. Please try again.");
      }
    } catch (err: any) {
      // SDK load failure or other unexpected
      setStage("failed");
      setStatusMsg(err?.message || "Something went wrong. Please retry.");
    }
  };

  const handlePay = async () => {
    if (busy) return;
    // If we already have a pending session, reuse it (don't create a new order)
    if (pendingOrderRef.current) {
      await openCashfreeForSession(
        pendingOrderRef.current.order_id,
        pendingOrderRef.current.payment_session_id,
      );
      return;
    }

    setStage("creating");
    setStatusMsg("Setting up secure checkout…");
    try {
      // Parallelize: create order + ensure SDK loaded simultaneously
      const [orderRes] = await Promise.all([
        supabase.functions.invoke("cashfree-create-order", { body: { store_id: storeId } }),
        loadCashfree("production").catch(() => null),
      ]);
      const { data, error } = orderRes;
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.payment_session_id || !data?.order_id) {
        throw new Error("Could not initialize payment. Please retry.");
      }
      pendingOrderRef.current = {
        order_id: data.order_id,
        payment_session_id: data.payment_session_id,
      };
      await openCashfreeForSession(data.order_id, data.payment_session_id);
    } catch (err: any) {
      setStage("failed");
      setStatusMsg(err?.message || "Could not start payment. Please retry.");
    }
  };

  // Manual "Check status" — for pending state
  const handleCheckStatus = async () => {
    if (!pendingOrderRef.current) return;
    setStage("verifying");
    setStatusMsg("Checking payment status…");
    const verdict = await verifyOrder(pendingOrderRef.current.order_id, 2);
    if (verdict === "paid") return onSuccess();
    if (verdict === "failed") {
      pendingOrderRef.current = null;
      setStage("failed");
      setStatusMsg("Payment failed. Please try again.");
      return;
    }
    setStage("pending");
    setStatusMsg("Still processing. Please wait a moment and check again.");
  };

  // Deterministic weekly counter
  const weeklyUpgrades = (() => {
    const week = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
    return 18 + (week % 17);
  })();

  const showRetry = stage === "failed" || stage === "cancelled";
  const showPendingActions = stage === "pending";

  const buttonLabel = (() => {
    if (stage === "creating") return "Preparing checkout…";
    if (stage === "checkout") return "Waiting for payment…";
    if (stage === "verifying") return "Verifying…";
    if (showRetry) return `Retry Payment ₹${state.price}`;
    return `Pay ₹${state.price} & Unlock Dashboard`;
  })();

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="p-6 space-y-5 text-center">
          <div className={`mx-auto h-14 w-14 rounded-full flex items-center justify-center ${stage === "pending" ? "bg-amber-500/10" : "bg-destructive/10"}`}>
            <AlertTriangle className={`h-7 w-7 ${stage === "pending" ? "text-amber-600" : "text-destructive"}`} />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Subscription payment due</h1>
            <p className="text-sm text-muted-foreground mt-2">
              Your dashboard is locked until your monthly subscription is paid. Your storefront is still live and serving customers — pay now to regain dashboard access.
            </p>
          </div>

          {/* Live social proof */}
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

          {/* Status / cancel / failure messaging */}
          {statusMsg && (
            <div className={`rounded-lg border px-3 py-2 text-xs ${
              stage === "failed" ? "border-destructive/30 bg-destructive/5 text-destructive" :
              stage === "cancelled" ? "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400" :
              stage === "pending" ? "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400" :
              "border-border bg-muted/40 text-muted-foreground"
            }`}>
              {statusMsg}
            </div>
          )}

          <Button onClick={handlePay} disabled={busy} size="lg" className="w-full">
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {showRetry && !busy && <RefreshCw className="mr-2 h-4 w-4" />}
            {buttonLabel}
          </Button>

          {showPendingActions && (
            <Button onClick={handleCheckStatus} variant="outline" size="sm" className="w-full" disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-2 h-3 w-3" />}
              Check payment status
            </Button>
          )}

          {/* Trust badges */}
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
