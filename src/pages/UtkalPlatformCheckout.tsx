import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { loadCashfree } from "@/lib/loadCashfree";
import { UTKAL_PLATFORM_CASHFREE_ENABLED } from "@/lib/utkalPlatformCashfree";

type Payment = { order_id: string; amount: number; total: number; balance: number; payment_type: string; paid?: boolean; review?: boolean; payment_session_id?: string; environment?: "sandbox" | "production" };
const STORAGE_KEY = "utkal_platform_handoff";
const COOKIE_NAME = "utkal_handoff";
const money = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(n);

function readCapability() {
  const hash = new URLSearchParams(window.location.hash.slice(1));
  const fresh = hash.get("handoff") || hash.get("platform_payment");
  if (fresh && /^[a-f0-9]{64}$/.test(fresh)) {
    try { sessionStorage.setItem(STORAGE_KEY, fresh); } catch { /* cookie fallback */ }
    document.cookie = `${COOKIE_NAME}=${fresh}; Path=/utkalwatch/checkout; Max-Age=1800; SameSite=Lax; Secure`;
    // Capabilities never enter request URLs, referrers, metadata or analytics.
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    return fresh;
  }
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored && /^[a-f0-9]{64}$/.test(stored)) return stored;
  } catch { /* cookie fallback */ }
  return document.cookie.match(/(?:^|;\s*)utkal_handoff=([a-f0-9]{64})(?:;|$)/)?.[1] || null;
}

export default function UtkalPlatformCheckout() {
  const [token] = useState(readCapability);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [error, setError] = useState(UTKAL_PLATFORM_CASHFREE_ENABLED ? "" : "This payment option is not active yet.");
  const [busy, setBusy] = useState(false);
  const started = useRef(false);
  const isStoreReturn = window.location.hostname === "utkalwatch.in";
  const returned = isStoreReturn || new URLSearchParams(window.location.search).has("returned");

  useEffect(() => {
    const robots = document.createElement("meta");
    robots.name = "robots"; robots.content = "noindex,nofollow";
    const referrer = document.createElement("meta");
    referrer.name = "referrer"; referrer.content = "no-referrer";
    document.head.append(robots, referrer);
    document.title = "Utkal Watch — Secure payment";
    return () => { robots.remove(); referrer.remove(); };
  }, []);

  const invoke = async (action: "session" | "verify") => {
    const { data, error: requestError } = await supabase.functions.invoke("utkal-platform-cashfree", { body: { action, token } });
    if (requestError || data?.error) throw new Error(data?.error || "Could not check payment. Please retry.");
    return data as Payment;
  };

  const check = async () => {
    if (!UTKAL_PLATFORM_CASHFREE_ENABLED || !token || busy) return;
    setBusy(true); setError("");
    try {
      const result = await invoke("verify");
      setPayment(result);
      if (result.paid && !isStoreReturn) {
        window.location.replace(`https://utkalwatch.in/checkout#platform_payment=${encodeURIComponent(token)}`);
      } else if (result.review) setError("Payment needs review. Do not pay again.");
      else if (!result.paid) setError("Payment is not confirmed yet. Check again before paying again.");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not check payment."); }
    finally { setBusy(false); }
  };

  useEffect(() => {
    if (!UTKAL_PLATFORM_CASHFREE_ENABLED || started.current) return;
    started.current = true;
    if (!token) { setError("This payment link is invalid or expired."); return; }
    if (returned) { void check(); return; }
    setBusy(true);
    void (async () => {
      try {
        const result = await invoke("session");
        setPayment(result);
        if (result.paid) { setBusy(false); await check(); return; }
        if (!result.payment_session_id) throw new Error("Payment session unavailable.");
        const cashfree = await loadCashfree(result.environment === "sandbox" ? "sandbox" : "production");
        const response = await cashfree.checkout({ paymentSessionId: result.payment_session_id, redirectTarget: "_self" });
        if (response?.error) throw new Error("Payment was not completed. Check payment status before trying again.");
      } catch (e) { setError(e instanceof Error ? e.message : "Could not open payment."); }
      finally { setBusy(false); }
    })();
    // Initial navigation only; explicit status checks are separate.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, returned]);

  return (
    <main className="min-h-screen bg-background text-foreground px-5 py-12">
      <div className="mx-auto max-w-md space-y-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><LockKeyhole className="h-4 w-4" /> Utkal Watch</div>
        <h1 className="text-2xl font-semibold">{payment?.paid ? "Order confirmed" : "Secure payment"}</h1>
        {payment?.paid && <CheckCircle2 className="h-10 w-10 text-primary" />}
        {payment && <dl className="divide-y divide-border text-sm">
          <div className="flex justify-between gap-4 py-3"><dt>Order total</dt><dd>{money(payment.total)}</dd></div>
          <div className="flex justify-between gap-4 py-3"><dt>{payment.paid ? "Paid online" : "Pay now"}</dt><dd className="font-semibold">{money(payment.amount)}</dd></div>
          <div className="flex justify-between gap-4 py-3"><dt>Balance on delivery</dt><dd>{money(payment.balance)}</dd></div>
          <div className="flex justify-between gap-4 py-3"><dt>Order</dt><dd className="break-all text-right">{payment.order_id.slice(0, 8)}</dd></div>
        </dl>}
        {busy && <div role="status" className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{returned ? "Checking payment…" : "Opening Cashfree…"}</div>}
        {error && <p role="alert" className="text-sm text-muted-foreground">{error}</p>}
        {UTKAL_PLATFORM_CASHFREE_ENABLED && token && !payment?.paid && <Button onClick={() => void check()} disabled={busy} variant="outline">Check payment status</Button>}
        <Button variant="outline" asChild><a href="https://utkalwatch.in">Return to Utkal Watch</a></Button>
      </div>
    </main>
  );
}