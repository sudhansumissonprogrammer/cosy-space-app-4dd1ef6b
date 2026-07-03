/**
 * CheckoutPhoneStep — Step 1 of the 2-step checkout.
 *
 * Full-page (not a modal). Captures the shopper's phone number BEFORE the
 * address/payment step so that:
 *   1. We can seed the address form with an auto-created guest account.
 *   2. The number is stored as a lead AND as an abandoned_carts row —
 *      if they close the tab now, `wa-cart-recovery-cron` will fire the
 *      abandoned_cart_v3 WhatsApp template after ≥30 min.
 *
 * The parent checkout page reads localStorage.getItem("checkout_phone");
 * as soon as that's set, this component un-mounts and the address/payment
 * form renders.
 */
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Loader2, Lock, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { supabaseStorefront } from "@/integrations/supabase/storefrontClient";
import {
  normalizePhone,
  isValidIndianPhone,
  toCanonicalIndianPhone,
} from "@/lib/phoneUtils";
import { getOrCreateSessionId } from "@/lib/visitorSession";
import { formatPrice } from "@/lib/productUtils";
import { useCart, type CartItem } from "@/contexts/CartContext";

interface Props {
  storeId?: string;
  storeName?: string;
  cartItems: CartItem[];
  /** Fires with the canonical 10-digit phone once Step 1 succeeds. */
  onComplete: (phone: string) => void;
}


async function autoLoginByPhone(storeId: string | undefined, phone: string) {
  if (!storeId) return;
  try {
    const { data, error } = await supabase.functions.invoke(
      "create-guest-account",
      { body: { phone, store_id: storeId } },
    );
    if (error) return;
    const result = data as {
      session?: { access_token?: string; refresh_token?: string };
    } | null;
    if (result?.session?.access_token && result?.session?.refresh_token) {
      await supabaseStorefront.auth.setSession({
        access_token: result.session.access_token,
        refresh_token: result.session.refresh_token,
      });
    }
  } catch {}
}

export default function CheckoutPhoneStep({
  storeId,
  storeName,
  cartItems,
  onComplete,
}: Props) {
  const [phone, setPhone] = useState<string>(() => {
    try {
      const saved = localStorage.getItem("checkout_phone") || "";
      const canon = toCanonicalIndianPhone(saved);
      return canon || saved.replace(/\D/g, "").slice(0, 10);
    } catch {
      return "";
    }
  });
  const [consent, setConsent] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(true);
  const inFlight = useRef(false);
  const { removeFromCart } = useCart();


  const digits = phone.replace(/\D/g, "");
  const valid = digits.length === 10 && /^[6-9]/.test(digits);

  const subtotal = cartItems.reduce(
    (sum, i) => sum + (Number(i.price) || 0) * (Number(i.quantity) || 1),
    0,
  );
  const itemCount = cartItems.reduce(
    (n, i) => n + (Number(i.quantity) || 1),
    0,
  );

  const submit = async () => {
    if (inFlight.current) return;
    const normalized = normalizePhone(digits);
    if (!isValidIndianPhone(normalized)) {
      toast.error("Please enter a valid 10-digit mobile number");
      return;
    }
    const canon = toCanonicalIndianPhone(digits);
    if (!canon) {
      toast.error("Please enter a valid Indian mobile number");
      return;
    }

    inFlight.current = true;
    setSubmitting(true);
    try {
      try {
        localStorage.setItem("checkout_phone", normalized);
      } catch {}

      // Persist lead + abandoned-cart in one RPC (SECURITY DEFINER, anon-callable).
      const session_token = (() => {
        try {
          return getOrCreateSessionId();
        } catch {
          return null;
        }
      })();

      // Slim the cart snapshot to avoid ballooning the JSONB payload.
      const cartSnapshot = cartItems.map((i) => ({
        productId: i.productId,
        variantId: i.variantId,
        name: i.name,
        price: i.price,
        quantity: i.quantity,
        image: i.image,
      }));


      const { data: rpcData } = await (supabase as any).rpc("capture_checkout_lead", {
        p_store_id: storeId,
        p_phone: canon,
        p_cart_items: cartSnapshot,
        p_consent: consent,
        p_session_token: session_token,
        p_source: "checkout_step1",
      });

      // Share the abandoned_cart id with Step 2 so it doesn't create a
      // duplicate row. `ac_{storeId}` is the same key CheckoutPageInner /
      // V22CheckoutPageInner already look up before inserting.
      try {
        const cartId = (rpcData as any)?.cart_id;
        if (cartId && storeId) {
          sessionStorage.setItem(`ac_${storeId}`, String(cartId));
        }
      } catch {}

      // Fire-and-forget guest auto-login so Step 2 sees a hydrated session.
      void autoLoginByPhone(storeId, normalized);

      onComplete(normalized);

    } catch (err) {
      console.warn("[CheckoutPhoneStep] capture failed:", err);
      // Still advance — the number is in localStorage, order flow can retry.
      onComplete(normalized);
    } finally {
      setSubmitting(false);
      inFlight.current = false;
    }
  };

  useEffect(() => {
    const el = document.getElementById("checkout-phone-input");
    el?.focus();
  }, []);

  return (
    <div
      className="min-h-[70vh] w-full px-4 py-6 sm:py-10"
      style={{
        background:
          "var(--storefront-bg, hsl(var(--background)))",
        color: "var(--storefront-text, hsl(var(--foreground)))",
      }}
    >
      <div className="mx-auto grid w-full max-w-3xl gap-6 md:grid-cols-[minmax(0,1fr)_320px]">
        {/* Step 1 card */}
        <div className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
          {/* Progress */}
          <div className="mb-5 flex items-center gap-3 text-xs font-medium">
            <span className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                1
              </span>
              Phone
            </span>
            <span className="h-px flex-1 bg-border" />
            <span className="flex items-center gap-2 opacity-50">
              <span className="flex h-6 w-6 items-center justify-center rounded-full border">
                2
              </span>
              Address & Payment
            </span>
          </div>

          <h1 className="text-lg font-semibold sm:text-xl">
            Enter your mobile number
          </h1>
          <p className="mt-1 text-sm opacity-70">
            We'll send your order confirmation on WhatsApp.
          </p>

          <div className="mt-5 space-y-4">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium opacity-60">
                +91
              </span>
              <Input
                id="checkout-phone-input"
                type="tel"
                inputMode="numeric"
                maxLength={10}
                placeholder="10-digit mobile number"
                value={phone}
                onChange={(e) =>
                  setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" && valid && !submitting) submit();
                }}
                className="h-12 rounded-xl pl-12 text-base"
                autoFocus
                autoComplete="tel-national"
              />
            </div>

            <label className="flex cursor-pointer items-start gap-2 text-xs opacity-80">
              <Checkbox
                checked={consent}
                onCheckedChange={(v) => setConsent(v === true)}
                className="mt-0.5"
              />
              <span>
                Send me order updates and offers on WhatsApp.
                <br />
                <span className="opacity-60">
                  You can opt out anytime by replying STOP.
                </span>
              </span>
            </label>

            <Button
              onClick={submit}
              disabled={submitting}
              className="h-12 w-full rounded-xl bg-primary text-sm font-bold uppercase tracking-wider text-primary-foreground hover:bg-primary/90 disabled:opacity-100"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
                </>
              ) : (
                "Continue to address"
              )}
            </Button>


            <div className="flex items-center justify-center gap-4 pt-1 text-[11px] opacity-60">
              <span className="flex items-center gap-1">
                <Lock className="h-3.5 w-3.5" /> Secure checkout
              </span>
              <span className="flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5" /> Privacy protected
              </span>
            </div>
          </div>
        </div>

        {/* Order Summary — collapsible, per-line remove */}
        <aside className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
          <button
            type="button"
            onClick={() => setSummaryOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-2 text-left"
          >
            <span className="text-sm font-semibold">
              Order Summary
              <span className="opacity-60"> · {itemCount} item{itemCount === 1 ? "" : "s"}</span>
            </span>
            <span className="flex items-center gap-2">
              <span className="text-sm font-semibold tabular-nums">
                {formatPrice(subtotal)}
              </span>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${summaryOpen ? "rotate-180" : ""}`}
              />
            </span>
          </button>

          {summaryOpen && (
            <div className="mt-3 space-y-3">
              {cartItems.map((i, idx) => (
                <div
                  key={`${i.productId}-${i.variantId ?? "base"}-${idx}`}
                  className="flex items-start gap-3"
                >
                  {i.image ? (
                    <img
                      src={i.image}
                      alt={i.name}
                      loading="lazy"
                      className="h-14 w-14 flex-shrink-0 rounded-lg border object-cover"
                    />
                  ) : (
                    <div className="h-14 w-14 flex-shrink-0 rounded-lg border bg-muted" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-2 text-sm font-medium">
                      {i.name || "Item"}
                    </div>
                    <div className="mt-0.5 text-xs opacity-60">
                      Qty: {i.quantity || 1}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <span className="text-sm font-semibold tabular-nums">
                      {formatPrice(
                        (Number(i.price) || 0) * (Number(i.quantity) || 1),
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeFromCart(i.productId, i.variantId)}
                      className="flex items-center gap-1 text-[11px] opacity-60 transition hover:text-destructive hover:opacity-100"
                      aria-label={`Remove ${i.name}`}
                    >
                      <Trash2 className="h-3 w-3" />
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Coupon lives on Step 2 — not shown here. */}


          {storeName && (
            <p className="mt-3 text-[11px] opacity-50">from {storeName}</p>
          )}

        </aside>
      </div>
    </div>
  );
}
