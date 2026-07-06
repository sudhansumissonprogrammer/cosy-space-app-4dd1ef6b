// CheckoutV2 — GoKwik-style 1-page checkout with direct UPI app tiles.
//
// Rendered ONLY when the URL has ?v2=1 OR the store has `checkout_v2_enabled=true`
// (see gating in src/pages/CheckoutPage.tsx). All existing checkout flows remain
// the default and are completely untouched.
//
// Flow:
//   1. Shopper enters phone → name → address (auto-fill from pincode).
//   2. Tap "Continue to Pay" → creates order via `place-order` (status=pending)
//      AND fires 4 `create-upi-intent` calls in parallel (gpay/phonepe/paytm/any)
//      so tap-to-open is instant on iOS Safari (no async delay).
//   3. Tap GPay/PhonePe/Paytm/Any-UPI tile → `location.href = intent_url` fires
//      synchronously → UPI app opens with amount pre-filled.
//   4. Waiting screen polls `order-payment-status` every 2s (up to 3 min).
//   5. On success → navigate to order tracking page.
import { useState, useEffect, useMemo, useRef } from "react";
import { useOutletContext, useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/contexts/CartContext";
import { useStorefrontAuth } from "@/contexts/StorefrontAuthContext";
import { formatPrice } from "@/lib/productUtils";
import { normalizePhone, isValidIndianPhone } from "@/lib/phoneUtils";
import { storefrontPath } from "@/lib/subdomain";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, MapPin, ShieldCheck, CheckCircle2, ArrowLeft, Lock, CreditCard, Banknote } from "lucide-react";
import { toast } from "sonner";
import type { StoreData } from "@/layouts/StorefrontLayout";
import { generateEventId } from "@/hooks/useFacebookPixel";

type UpiApp = "gpay" | "phonepe" | "paytm" | "any";

interface IntentState {
  status: "idle" | "loading" | "ready" | "failed";
  url?: string;
  error?: string;
}

const UPI_APPS: { key: UpiApp; label: string; icon: string; deeplinkScheme: string }[] = [
  { key: "gpay", label: "Google Pay", icon: "/icons/gpay.svg", deeplinkScheme: "tez://" },
  { key: "phonepe", label: "PhonePe", icon: "/icons/phonepe.svg", deeplinkScheme: "phonepe://" },
  { key: "paytm", label: "Paytm", icon: "/icons/paytm.svg", deeplinkScheme: "paytmmp://" },
  { key: "any", label: "Any UPI app", icon: "/icons/upi.png", deeplinkScheme: "upi://" },
];

function isMobile(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/** Rewrite an intent URL to use an app-specific scheme (Cashfree returns upi:// — GPay opens best on gpay://). */
function schemeFor(app: UpiApp, url: string): string {
  if (!url) return url;
  if (app === "any") return url;
  // Replace leading "upi://" with app-specific scheme so target app opens directly.
  const rest = url.replace(/^upi:\/\//i, "");
  if (app === "gpay") return `tez://upi/${rest.replace(/^\/*/, "")}`;
  if (app === "phonepe") return `phonepe://upi/${rest.replace(/^\/*/, "")}`;
  if (app === "paytm") return `paytmmp://upi/${rest.replace(/^\/*/, "")}`;
  return url;
}

export default function CheckoutV2Page() {
  const store = useOutletContext<StoreData>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { items: cartItems, clearCart } = useCart();
  const { customer } = useStorefrontAuth();
  const currency = store?.currency || "INR";

  // ─── Form state ─────────────────────────────────────────────────────────
  const [phone, setPhone] = useState<string>(() => {
    try {
      const saved = localStorage.getItem("checkout_phone") || "";
      const n = normalizePhone(saved);
      return isValidIndianPhone(n) ? n : "";
    } catch { return ""; }
  });
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [pincode, setPincode] = useState("");
  const [streetAddress, setStreetAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");

  // Prefill from previous saved checkout
  useEffect(() => {
    if (!store?.id) return;
    try {
      const raw = localStorage.getItem(`express_checkout_${store.id}`);
      if (raw) {
        const p = JSON.parse(raw);
        setFullName(p.fullName || "");
        setEmail(p.email || "");
        setPincode(p.pincode || "");
        setStreetAddress(p.streetAddress || "");
        setCity(p.city || "");
        setState(p.state || "");
      }
    } catch { /* noop */ }
  }, [store?.id]);

  // Auto-fill city+state from pincode
  useEffect(() => {
    if (!/^\d{6}$/.test(pincode)) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
        const j = await res.json();
        const po = j?.[0]?.PostOffice?.[0];
        if (!cancelled && po) {
          if (!city) setCity(po.District || "");
          if (!state) setState(po.State || "");
        }
      } catch { /* noop */ }
    })();
    return () => { cancelled = true; };
  }, [pincode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Cart totals ────────────────────────────────────────────────────────
  const subtotal = useMemo(
    () => cartItems.reduce((s, i) => s + i.price * i.quantity, 0),
    [cartItems],
  );
  const total = subtotal;

  // ─── Store-level partial payment config ─────────────────────────────────
  const partialEnabled: boolean = (store as any)?.partial_payment_enabled ?? false;
  const partialType: string = (store as any)?.partial_payment_type || "percentage";
  const partialValue: number | null = (store as any)?.partial_payment_value ?? null;
  const hasPartial = partialEnabled && !!partialValue && Number(partialValue) > 0;

  // Compute advance for the whole cart (mirrors CheckoutPage math)
  const partialAdvanceTotal = useMemo(() => {
    if (!hasPartial) return total;
    let advance = 0;
    for (const it of cartItems) {
      let itemAdv = partialType === "percentage"
        ? Math.round(it.price * (Number(partialValue) / 100))
        : Math.min(Number(partialValue), it.price);
      itemAdv = Math.max(itemAdv, 50);
      advance += itemAdv * it.quantity;
    }
    return Math.max(50, Math.min(total, Math.round(advance)));
  }, [cartItems, hasPartial, partialType, partialValue, total]);
  const partialBalanceDue = Math.max(0, total - partialAdvanceTotal);

  // Payment mode: only relevant when partial is enabled. Defaults to "partial"
  // (matches legacy CheckoutPage default) so the user sees the discounted
  // upfront amount without an extra click.
  const [payMode, setPayMode] = useState<"full" | "partial">("partial");
  const effectiveMode: "full" | "partial" = hasPartial ? payMode : "full";
  const chargeAmount = effectiveMode === "partial" ? partialAdvanceTotal : total;

  // ─── Order creation + intent pre-generation ─────────────────────────────
  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [showPayment, setShowPayment] = useState(false);

  const [intents, setIntents] = useState<Record<UpiApp, IntentState>>({
    gpay: { status: "idle" }, phonepe: { status: "idle" },
    paytm: { status: "idle" }, any: { status: "idle" },
  });

  const purchaseEventIdRef = useRef<string>(generateEventId());

  const validateAddress = (): string | null => {
    if (!fullName.trim()) return "Please enter your name";
    const nPhone = normalizePhone(phone);
    if (!isValidIndianPhone(nPhone)) return "Enter a valid 10-digit phone number";
    if (!/^\d{6}$/.test(pincode)) return "Enter a valid 6-digit pincode";
    if (!streetAddress.trim()) return "Enter your street address";
    if (!city.trim()) return "Enter city";
    if (!state.trim()) return "Enter state";
    return null;
  };

  const createOrderAndIntents = async () => {
    const err = validateAddress();
    if (err) { toast.error(err); return; }
    if (cartItems.length === 0) { toast.error("Your cart is empty"); return; }

    setCreatingOrder(true);
    try {
      // Persist address for future visits
      try {
        localStorage.setItem("checkout_phone", normalizePhone(phone));
        localStorage.setItem(`express_checkout_${store.id}`, JSON.stringify({
          fullName, email, pincode, streetAddress, city, state,
        }));
      } catch { /* noop */ }

      const { data, error } = await supabase.functions.invoke("place-order", {
        body: {
          store_id: store.id,
          order: {
            total,
            currency,
            status: "pending",
            customer_name: fullName.trim(),
            customer_phone: normalizePhone(phone),
            street_address: streetAddress.trim(),
            city: city.trim(),
            state: state.trim(),
            pincode: pincode.trim(),
            payment_method: "razorpay", // placeholder — actual gateway resolved by create-upi-intent
            storefront_customer_id: customer?.id ?? null,
            payment_type: effectiveMode,
          },
          items: cartItems.map((it) => ({
            productId: it.productId,
            name: it.name,
            price: it.price,
            quantity: it.quantity,
          })),
          meta: { event_id: purchaseEventIdRef.current },
        },
      });
      if (error) throw new Error(error.message);
      const result = data as { order_id?: string; order_number?: string; error?: string } | null;
      if (!result?.order_id) throw new Error(result?.error || "Failed to place order");

      setOrderId(result.order_id);
      setOrderNumber(result.order_number || null);
      setShowPayment(true);

      // Pre-generate all 4 UPI intent URLs in parallel — required so tapping a
      // tile on iOS Safari fires location.href synchronously (no await).
      const apps: UpiApp[] = ["gpay", "phonepe", "paytm", "any"];
      setIntents((s) => {
        const next = { ...s };
        apps.forEach((a) => { next[a] = { status: "loading" }; });
        return next;
      });

      apps.forEach(async (app) => {
        try {
          const { data: intentData, error: intErr } = await supabase.functions.invoke("create-upi-intent", {
            body: {
              store_id: store.id,
              order_id: result.order_id,
              app,
              customer_name: fullName.trim(),
              customer_phone: normalizePhone(phone),
              customer_email: email.trim() || undefined,
            },
          });
          // functions.invoke returns error for non-2xx BUT data still contains the JSON body
          const payload: any = intentData ?? (intErr as any)?.context?.body;
          const url: string | undefined = payload?.intent_url;
          if (!url) {
            const errMsg: string = payload?.error || intErr?.message || "Failed";
            setIntents((s) => ({ ...s, [app]: { status: "failed", error: errMsg } }));
            return;
          }
          setIntents((s) => ({ ...s, [app]: { status: "ready", url: schemeFor(app, url) } }));
        } catch (e: any) {
          setIntents((s) => ({ ...s, [app]: { status: "failed", error: e.message || "Failed" } }));
        }
      });
    } catch (e: any) {
      toast.error(e.message || "Failed to create order");
    } finally {
      setCreatingOrder(false);
    }
  };

  // ─── Payment polling ────────────────────────────────────────────────────
  const [waiting, setWaiting] = useState(false);
  const [waitingApp, setWaitingApp] = useState<string>("");

  useEffect(() => {
    if (!waiting || !orderId) return;
    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 90; // 3 min at 2s
    const poll = async () => {
      if (cancelled) return;
      attempts++;
      try {
        const { data } = await supabase.functions.invoke("order-payment-status", {
          body: { store_id: store.id, order_id: orderId },
        });
        const status = (data as any)?.payment_status;
        if (status === "success") {
          clearCart();
          navigate(storefrontPath(store.slug, `account/orders/${orderId}`));
          return;
        }
        if (status === "failed") {
          toast.error("Payment failed — please try again");
          setWaiting(false);
          return;
        }
      } catch { /* keep polling */ }
      if (attempts >= maxAttempts) {
        toast("Still waiting? Tap 'I've paid' to re-check", { duration: 6000 });
        return;
      }
      setTimeout(poll, 2000);
    };
    setTimeout(poll, 2000);
    return () => { cancelled = true; };
  }, [waiting, orderId]); // eslint-disable-line react-hooks/exhaustive-deps

  const tapUpiApp = (app: UpiApp) => {
    const s = intents[app];
    if (s.status !== "ready" || !s.url) return;
    setWaitingApp(UPI_APPS.find((u) => u.key === app)?.label || "UPI");
    setWaiting(true);
    // Suppress the checkout beforeunload "Confirm Navigation" prompt —
    // opening a upi:// intent counts as a navigation in Instagram / FB
    // in-app browsers, and the warning scares customers away.
    try { window.dispatchEvent(new Event("payment-in-progress")); } catch { /* noop */ }
    // MUST be synchronous in same tap event for iOS Safari
    window.location.href = s.url;
  };

  const [placingCod, setPlacingCod] = useState(false);
  const placeCod = async () => {
    if (!orderId || placingCod) return;
    setPlacingCod(true);
    try {
      const { data, error } = await supabase.functions.invoke("checkout-v2-cod", {
        body: { store_id: store.id, order_id: orderId },
      });
      if (error) throw new Error(error.message);
      const res = data as { ok?: boolean; error?: string } | null;
      if (!res?.ok) throw new Error(res?.error || "Failed to place COD order");
      clearCart();
      navigate(storefrontPath(store.slug, `account/orders/${orderId}`));
    } catch (e: any) {
      toast.error(e.message || "Failed to place COD order");
    } finally {
      setPlacingCod(false);
    }
  };

  const forceRecheck = () => {
    setWaiting(false);
    setTimeout(() => setWaiting(true), 100);
  };

  // ─── Empty cart guard ──────────────────────────────────────────────────
  if (cartItems.length === 0 && !orderId) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <p className="text-muted-foreground">Your cart is empty.</p>
        <Button className="mt-4" onClick={() => navigate(storefrontPath(store.slug))}>Continue shopping</Button>
      </div>
    );
  }

  // ─── Waiting screen ────────────────────────────────────────────────────
  if (waiting) {
    return (
      <div className="mx-auto max-w-md p-6 pt-16 text-center">
        <div className="mx-auto mb-6 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
        </div>
        <h1 className="text-xl font-bold mb-2">Complete payment in {waitingApp}</h1>
        <p className="text-sm text-muted-foreground mb-8">
          Approve the payment request of <span className="font-semibold text-foreground">{formatPrice(chargeAmount, currency)}</span> in {waitingApp} to confirm your order.
        </p>
        <div className="rounded-lg border bg-muted/30 p-4 text-left text-xs text-muted-foreground mb-6">
          <div className="flex items-start gap-2">
            <ShieldCheck className="h-4 w-4 mt-0.5 text-emerald-600 flex-shrink-0" />
            <div>Do not close this page. We'll confirm automatically once you approve payment in the app.</div>
          </div>
        </div>
        <Button variant="outline" className="w-full" onClick={forceRecheck}>
          I've paid — check now
        </Button>
        <button
          className="mt-3 text-xs text-muted-foreground underline"
          onClick={() => setWaiting(false)}
        >
          Cancel and choose another method
        </button>
      </div>
    );
  }

  // ─── Main layout: Address + Payment tiles ──────────────────────────────
  const mobile = isMobile();

  return (
    <div className="mx-auto max-w-md min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} aria-label="Back" className="p-1">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <div className="text-sm font-semibold">Secure Checkout</div>
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <Lock className="h-3 w-3" /> {store?.name || "Store"}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">Total</div>
          <div className="text-base font-bold">{formatPrice(total, currency)}</div>
        </div>
      </div>

      {/* Contact + address */}
      {!showPayment && (
        <div className="p-4 space-y-4">
          <div>
            <h2 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <span className="h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">1</span>
              Contact & Shipping
            </h2>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Phone *</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98xxxxxxxx" inputMode="numeric" maxLength={10} />
                </div>
                <div>
                  <Label className="text-xs">Full Name *</Label>
                  <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" />
                </div>
              </div>
              <div>
                <Label className="text-xs">Email (optional)</Label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" type="email" />
              </div>
              <div>
                <Label className="text-xs">Pincode *</Label>
                <Input value={pincode} onChange={(e) => setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="6-digit pincode" inputMode="numeric" maxLength={6} />
              </div>
              <div>
                <Label className="text-xs">House / Street / Area *</Label>
                <Input value={streetAddress} onChange={(e) => setStreetAddress(e.target.value)} placeholder="Flat, building, street, area" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">City *</Label>
                  <Input value={city} onChange={(e) => setCity(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">State *</Label>
                  <Input value={state} onChange={(e) => setState(e.target.value)} />
                </div>
              </div>
            </div>
          </div>

          {/* Partial-payment mode selector — visible only when store enabled it */}
          {hasPartial && (
            <div className="rounded-lg border p-3">
              <div className="text-xs font-semibold mb-2 flex items-center gap-2">
                <span className="h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">2</span>
                Payment Option
              </div>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setPayMode("partial")}
                  className={`w-full text-left rounded-lg border-2 p-3 transition-colors ${payMode === "partial" ? "border-primary bg-primary/5" : "border-border"}`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${payMode === "partial" ? "border-primary bg-primary" : "border-muted-foreground"}`}>
                      {payMode === "partial" && <CheckCircle2 className="h-3 w-3 text-primary-foreground" />}
                    </div>
                    <div className="text-sm font-semibold">Pay {formatPrice(partialAdvanceTotal, currency)} now · {formatPrice(partialBalanceDue, currency)} on delivery</div>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1 ml-6">Pay advance online to confirm, rest as cash on delivery.</div>
                </button>
                <button
                  type="button"
                  onClick={() => setPayMode("full")}
                  className={`w-full text-left rounded-lg border-2 p-3 transition-colors ${payMode === "full" ? "border-primary bg-primary/5" : "border-border"}`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${payMode === "full" ? "border-primary bg-primary" : "border-muted-foreground"}`}>
                      {payMode === "full" && <CheckCircle2 className="h-3 w-3 text-primary-foreground" />}
                    </div>
                    <div className="text-sm font-semibold">Pay full {formatPrice(total, currency)} online</div>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Order summary */}
          <div className="rounded-lg border p-3 bg-muted/30">
            <div className="text-xs font-semibold mb-2">Order Summary</div>
            <div className="space-y-1 text-xs">
              {cartItems.map((it) => (
                <div key={`${it.productId}-${it.variantId || ""}`} className="flex justify-between">
                  <span className="truncate flex-1">{it.name} × {it.quantity}</span>
                  <span>{formatPrice(it.price * it.quantity, currency)}</span>
                </div>
              ))}
              <div className="border-t pt-2 mt-2 flex justify-between font-bold text-sm">
                <span>Total</span>
                <span>{formatPrice(total, currency)}</span>
              </div>
              {hasPartial && effectiveMode === "partial" && (
                <>
                  <div className="flex justify-between text-xs pt-1">
                    <span className="text-muted-foreground">Pay now (advance)</span>
                    <span className="font-semibold">{formatPrice(partialAdvanceTotal, currency)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Balance on delivery</span>
                    <span className="font-semibold">{formatPrice(partialBalanceDue, currency)}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Fixed CTA / Payment tiles */}
      {!showPayment ? (
        <div className="fixed bottom-0 left-0 right-0 border-t bg-background p-3 max-w-md mx-auto">
          <Button
            className="w-full h-12 text-base font-bold"
            onClick={createOrderAndIntents}
            disabled={creatingOrder}
          >
            {creatingOrder ? <Loader2 className="h-5 w-5 animate-spin" /> : `Continue to Pay ${formatPrice(chargeAmount, currency)}`}
          </Button>
        </div>
      ) : (
        <div className="p-4 space-y-4">
          {/* Address recap */}
          <div className="rounded-lg border p-3 text-xs">
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
              <div className="flex-1">
                <div className="font-semibold">{fullName} · {phone}</div>
                <div className="text-muted-foreground">{streetAddress}, {city}, {state} - {pincode}</div>
              </div>
              <button className="text-primary underline text-xs" onClick={() => setShowPayment(false)}>Edit</button>
            </div>
          </div>

          {(() => {
            const allFailed = (["gpay","phonepe","paytm","any"] as UpiApp[]).every((k) => intents[k].status === "failed");
            if (!allFailed) return null;
            const firstErr = intents.any.error || intents.gpay.error || "UPI is temporarily unavailable";
            const goClassic = () => {
              const url = new URL(window.location.href);
              url.searchParams.delete("v2");
              window.location.href = url.toString();
            };
            return (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200 mb-3">
                <div className="font-semibold mb-1">UPI apps unavailable</div>
                <div className="mb-2 opacity-80">{firstErr}</div>
                <Button size="sm" variant="outline" className="w-full" onClick={goClassic}>Use standard checkout instead</Button>
              </div>
            );
          })()}

          <div>
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <span className="h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">2</span>
              Pay {formatPrice(chargeAmount, currency)}{hasPartial && effectiveMode === "partial" ? " advance" : ""}
            </h2>


            {mobile && (
              <>
                <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">UPI apps</div>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {UPI_APPS.slice(0, 3).map((app) => {
                    const s = intents[app.key];
                    const disabled = s.status !== "ready";
                    return (
                      <button
                        key={app.key}
                        onClick={() => tapUpiApp(app.key)}
                        disabled={disabled}
                        className="flex flex-col items-center justify-center rounded-lg border-2 border-transparent bg-muted/30 hover:border-primary hover:bg-primary/5 active:scale-95 transition-all p-3 disabled:opacity-40 disabled:cursor-not-allowed min-h-[80px]"
                      >
                        <img src={app.icon} alt={app.label} className="h-8 w-8 mb-1 object-contain" />
                        <div className="text-[10px] font-semibold">{app.label}</div>
                        {s.status === "loading" && <Loader2 className="h-3 w-3 animate-spin mt-1 text-muted-foreground" />}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => tapUpiApp("any")}
                  disabled={intents.any.status !== "ready"}
                  className="w-full flex items-center gap-3 rounded-lg border-2 border-transparent bg-muted/30 hover:border-primary hover:bg-primary/5 p-3 mb-3 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <img src="/icons/upi.png" alt="UPI" className="h-8 w-8 object-contain" />
                  <div className="text-sm font-semibold flex-1 text-left">Any UPI app</div>
                  {intents.any.status === "loading" ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : (
                    <span className="text-xs text-primary">→</span>
                  )}
                </button>
              </>
            )}

            {!mobile && (
              <div className="rounded-lg border p-4 mb-3 bg-muted/20 text-center">
                <div className="text-sm font-semibold mb-2">Scan QR to pay with any UPI app</div>
                {intents.any.status === "ready" && intents.any.url ? (
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(intents.any.url)}`}
                    alt="UPI QR"
                    className="mx-auto"
                    width={220}
                    height={220}
                  />
                ) : (
                  <div className="h-[220px] flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                )}
                <div className="text-xs text-muted-foreground mt-2">Amount: {formatPrice(total, currency)}</div>
                {intents.any.status === "ready" && (
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => setWaiting(true)}>
                    I've scanned — waiting for payment
                  </Button>
                )}
              </div>
            )}

            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 mt-4">Other options</div>
            <button
              onClick={placeCod}
              disabled={placingCod}
              className="w-full flex items-center gap-3 rounded-lg border-2 border-transparent bg-muted/30 hover:border-primary hover:bg-primary/5 p-3 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <div className="h-10 w-10 rounded bg-emerald-100 flex items-center justify-center">
                <Banknote className="h-5 w-5 text-emerald-700" />
              </div>
              <div className="flex-1 text-left">
                <div className="text-sm font-semibold">Cash on Delivery</div>
                <div className="text-xs text-muted-foreground">Pay when you receive</div>
              </div>
              {placingCod ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : <span className="text-xs text-primary">→</span>}
            </button>

            <div className="text-[10px] text-muted-foreground text-center mt-6 flex items-center justify-center gap-1">
              <ShieldCheck className="h-3 w-3" /> Payments secured by your bank & UPI
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
