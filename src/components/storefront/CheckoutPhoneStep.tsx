/**
 * CheckoutPhoneStep — Step 1 of the 2-step checkout.
 *
 * Captures the shopper's phone number BEFORE the address/payment step so:
 *   1. We seed the address form with an auto-created guest account.
 *   2. The number is stored as a lead + abandoned_carts row for WA recovery.
 *
 * Order Summary is expanded by default with qty +/- and Remove controls that
 * mutate the real cart (or buy-now qty) so any change propagates through the
 * whole checkout + payment gateway with no mismatch.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import shopbanaoLogo from "@/assets/shopbanao-logo.webp";
import {
  ArrowLeft,
  ChevronDown,
  Loader2,
  Lock,
  ShieldCheck,
  CheckCircle2,
  Trash2,
  ShoppingCart,
  Minus,
  Plus,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import type { CartItem } from "@/contexts/CartContext";
import { storefrontPath } from "@/lib/subdomain";
import StorefrontMarquee from "@/components/storefront/StorefrontMarquee";
import { useStorefrontThemeConfig } from "@/hooks/useStorefrontThemeConfig";
import { setCapiUser } from "@/lib/metaEnrichment";

interface Props {
  storeId?: string;
  storeSlug?: string;
  storeName?: string;
  storeLogo?: string;
  cartItems: CartItem[];
  /** True when in buy-now single mode — hides Remove (no cart to fall back to). */
  isSingleMode?: boolean;
  /** Called when the shopper taps +/- on a row. Parent decides cart vs buy-now qty. */
  onQuantityChange?: (item: CartItem, nextQty: number) => void;
  /** Called when the shopper taps Remove. Parent removes + navigates if cart empties. */
  onRemoveItem?: (item: CartItem) => void;
  /** Fires with the canonical 10-digit phone once Step 1 succeeds. */
  onComplete: (phone: string, savedAddress?: CheckoutSavedAddress | null) => void;
}

export interface CheckoutSavedAddress {
  id?: string | null;
  label?: string | null;
  full_name?: string | null;
  phone?: string | null;
  street_address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  is_default?: boolean | null;
}

async function autoLoginByPhone(storeId: string | undefined, phone: string) {
  if (!storeId) return null;
  try {
    const { data, error } = await supabase.functions.invoke(
      "create-guest-account",
      { body: { phone, store_id: storeId } },
    );
    if (error) return null;
    const result = data as {
      session?: { access_token?: string; refresh_token?: string };
      address?: CheckoutSavedAddress | null;
    } | null;
    if (result?.session?.access_token && result?.session?.refresh_token) {
      await supabaseStorefront.auth.setSession({
        access_token: result.session.access_token,
        refresh_token: result.session.refresh_token,
      });
    }
    return result;
  } catch {
    return null;
  }
}

export default function CheckoutPhoneStep({
  storeId,
  storeSlug,
  storeName,
  storeLogo,
  cartItems,
  isSingleMode,
  onQuantityChange,
  onRemoveItem,
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
  const [inlineError, setInlineError] = useState<string | null>(null);
  // Open by default so the shopper sees exactly what they're paying for.
  const [summaryOpen, setSummaryOpen] = useState(true);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const inFlight = useRef(false);
  const autoSubmittedRef = useRef(false);
  const themeConfig = useStorefrontThemeConfig(storeId);
  const marqueeEnabled = themeConfig?.marquee_enabled ?? true;

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

  // Store-owner auto-apply coupon — preview the reward BEFORE the shopper
  // commits their phone so the discount feels earned, not surprise-applied
  // on the next step. Same RPC + math the main checkout uses.
  const [autoCoupon, setAutoCoupon] = useState<{
    code: string;
    discount_type: string;
    discount_value: number;
    min_order_amount?: number | null;
  } | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!storeId) return;
    (async () => {
      try {
        const { data } = await (supabase as any).rpc(
          "get_store_auto_apply_coupon",
          { _store_id: storeId },
        );
        const row = Array.isArray(data) ? data[0] ?? null : data ?? null;
        if (!cancelled) setAutoCoupon(row);
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [storeId]);

  const autoCouponDiscount = useMemo(() => {
    if (!autoCoupon || subtotal <= 0) return 0;
    const min = Number(autoCoupon.min_order_amount || 0);
    if (subtotal < min) return 0;
    const raw =
      autoCoupon.discount_type === "percentage"
        ? (subtotal * Number(autoCoupon.discount_value || 0)) / 100
        : Number(autoCoupon.discount_value || 0);
    return Math.max(0, Math.min(raw, subtotal));
  }, [autoCoupon, subtotal]);


  const setQty = (item: CartItem, next: number) => {
    const n = Math.max(1, Math.min(99, Math.floor(next)));
    onQuantityChange?.(item, n);
  };

  const submit = async () => {
    if (inFlight.current) return;
    if (digits.length < 10) {
      setInlineError("Please enter your full 10-digit mobile number");
      document.getElementById("checkout-phone-input")?.focus();
      return;
    }
    const normalized = normalizePhone(digits);
    if (!isValidIndianPhone(normalized)) {
      setInlineError("Enter a valid Indian mobile number starting with 6-9");
      return;
    }
    const canon = toCanonicalIndianPhone(digits);
    if (!canon) {
      setInlineError("Enter a valid Indian mobile number");
      return;
    }
    setInlineError(null);

    inFlight.current = true;
    setSubmitting(true);
    try {
      try {
        localStorage.setItem("checkout_phone", canon);
      } catch {}

      // EMQ lift: seed Meta Advanced Matching + CAPI registry with the
      // phone RIGHT NOW so InitiateCheckout / AddPaymentInfo events fired
      // moments later ship with hashed phone in user_data. Without this,
      // step-1 users leave phone-less events → EMQ stuck at ~6.
      try {
        setCapiUser({ phone: canon });
      } catch {}


      const session_token = (() => {
        try {
          return getOrCreateSessionId();
        } catch {
          return null;
        }
      })();

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

      try {
        const cartId = (rpcData as any)?.cart_id;
        if (cartId && storeId) {
          sessionStorage.setItem(`ac_${storeId}`, String(cartId));
        }
      } catch {}

      const loginResult = await autoLoginByPhone(storeId, canon);
      onComplete(canon, loginResult?.address ?? null);
    } catch (err) {
      console.warn("[CheckoutPhoneStep] capture failed:", err);
      onComplete(canon);
    } finally {
      setSubmitting(false);
      inFlight.current = false;
    }
  };

  useEffect(() => {
    const el = document.getElementById("checkout-phone-input");
    el?.focus();
  }, []);

  // Auto-submit the moment a valid 10-digit number is entered — matches
  // Gokwik / Shiprocket UX. Guarded so it fires only once per successful
  // entry (not on every keystroke while typing more digits).
  useEffect(() => {
    if (valid && !submitting && !inFlight.current && !autoSubmittedRef.current) {
      autoSubmittedRef.current = true;
      // Small delay lets the digit render + keyboard settle before submit.
      const t = window.setTimeout(() => { void submit(); }, 120);
      return () => window.clearTimeout(t);
    }
    if (!valid) autoSubmittedRef.current = false;
  }, [valid, submitting]);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const syncKeyboardInset = () => {
      const inset = Math.max(
        0,
        window.innerHeight - viewport.height - viewport.offsetTop,
      );
      setKeyboardInset(inset > 24 ? Math.round(inset) : 0);
    };

    syncKeyboardInset();
    viewport.addEventListener("resize", syncKeyboardInset);
    viewport.addEventListener("scroll", syncKeyboardInset);
    return () => {
      viewport.removeEventListener("resize", syncKeyboardInset);
      viewport.removeEventListener("scroll", syncKeyboardInset);
    };
  }, []);

  return (
    <div className="mx-auto max-w-md min-h-screen bg-[#F5F5F5] pb-[220px]">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-white border-b border-[#ECECEC] px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => {
            try {
              if (window.history.length > 1) {
                window.history.back();
                return;
              }
            } catch {}
            window.location.href = storefrontPath(storeSlug || "");
          }}
          aria-label="Back"
          className="p-1 -ml-1"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        {storeLogo ? (
          <img
            src={storeLogo}
            alt={storeName || "Store"}
            className="h-8 w-auto max-w-[100px] object-contain"
          />
        ) : (
          <div className="text-sm font-bold truncate max-w-[140px]">
            {storeName || "Store"}
          </div>
        )}
        <div className="flex-1" />
        <div className="text-[13px] text-muted-foreground flex items-center gap-1">
          100% Secured Payment <Lock className="h-3.5 w-3.5" />
        </div>
      </div>

      {/* Announcement marquee — same dashboard-controlled component as main checkout */}
      {marqueeEnabled && (
        <div data-checkout-marquee className="sticky top-[57px] z-10">
          <StorefrontMarquee text={themeConfig?.marquee_text} />
        </div>
      )}


      <div className="px-3 py-3 space-y-3">
        {/* Auto-applied coupon reward banner — makes the discount feel earned
            before the shopper commits their phone number. */}
        {autoCouponDiscount > 0 && autoCoupon && (
          <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white overflow-hidden">
            <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-emerald-600 text-white">
              <Sparkles className="h-4 w-4 shrink-0" strokeWidth={2.6} />
              <div className="text-[12.5px] font-extrabold leading-tight tracking-tight flex-1">
                You got {formatPrice(autoCouponDiscount)} off!
              </div>
              <span className="text-[10.5px] font-bold bg-white/20 px-2 py-0.5 rounded">
                {autoCoupon.code}
              </span>
            </div>
            <div className="px-3.5 py-2 text-[11.5px] leading-snug text-gray-700">
              Coupon <span className="font-bold text-gray-900">{autoCoupon.code}</span> auto-applied · Enter your mobile number to claim
            </div>
          </div>
        )}

        {/* Order Summary — expanded by default with qty controls */}
        <div className="bg-white rounded-xl border border-[#ECECEC] p-3.5">
          <button
            type="button"
            onClick={() => setSummaryOpen((v) => !v)}
            className="w-full flex items-start gap-3 text-left"
          >
            <div className="h-9 w-9 rounded-md bg-[#F5F5F5] flex items-center justify-center flex-shrink-0">
              <ShoppingCart className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[15px] font-bold">Order Summary</div>
            </div>
            <div className="text-right">
              <div className="text-[11px] text-muted-foreground">
                {itemCount} item{itemCount !== 1 ? "s" : ""}
              </div>
              <div className="flex items-center gap-1 justify-end">
                <span className="text-[15px] font-bold">
                  {formatPrice(subtotal)}
                </span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${summaryOpen ? "rotate-180" : ""}`}
                />
              </div>
            </div>
          </button>

          {summaryOpen && (
            <div className="border-t border-[#ECECEC] mt-3 pt-3 space-y-3">
              {cartItems.map((it, idx) => {
                const qty = Number(it.quantity) || 1;
                const canRemove = !isSingleMode && !!onRemoveItem;
                return (
                  <div
                    key={`${it.productId}-${it.variantId ?? "base"}-${idx}`}
                    className="flex items-start gap-3"
                  >
                    {it.image ? (
                      <img
                        src={it.image}
                        alt={it.name}
                        loading="lazy"
                        className="h-14 w-14 flex-shrink-0 rounded-lg border object-cover"
                      />
                    ) : (
                      <div className="h-14 w-14 flex-shrink-0 rounded-lg border bg-muted" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="line-clamp-2 text-[13px] font-semibold">
                        {it.name || "Item"}
                      </div>
                      <div className="mt-1.5 inline-flex items-center gap-1 rounded-md border border-[#ECECEC] bg-white">
                        <button
                          type="button"
                          onClick={() => setQty(it, qty - 1)}
                          disabled={qty <= 1}
                          aria-label="Decrease quantity"
                          className="h-7 w-7 flex items-center justify-center text-muted-foreground disabled:opacity-40 active:bg-[#F5F5F5] rounded-l-md"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="min-w-[24px] text-center text-[12px] font-semibold tabular-nums">
                          {qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => setQty(it, qty + 1)}
                          disabled={qty >= 99}
                          aria-label="Increase quantity"
                          className="h-7 w-7 flex items-center justify-center text-muted-foreground disabled:opacity-40 active:bg-[#F5F5F5] rounded-r-md"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <span className="text-[13px] font-semibold tabular-nums">
                        {formatPrice(
                          (Number(it.price) || 0) * qty,
                        )}
                      </span>
                      {canRemove && (
                        <button
                          type="button"
                          onClick={() => onRemoveItem?.(it)}
                          className="flex items-center gap-1 text-[11px] text-muted-foreground transition hover:text-destructive"
                          aria-label={`Remove ${it.name}`}
                        >
                          <Trash2 className="h-3 w-3" />
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Mobile number card — single clear label, no clutter */}
        <div className="bg-white rounded-xl border border-[#ECECEC] overflow-hidden">
          <div className="p-3.5 space-y-3">
            <div
              className={`flex items-center h-12 rounded-lg border px-3 gap-2 transition-colors ${
                inlineError
                  ? "border-red-500 focus-within:border-red-500"
                  : "border-[#ECECEC] focus-within:border-black"
              }`}
            >
              <span className="text-[16px] leading-none" aria-hidden>🇮🇳</span>
              <span className="text-[14px] font-medium">+91</span>
              <span className="text-muted-foreground">|</span>
              <input
                id="checkout-phone-input"
                type="tel"
                inputMode="numeric"
                maxLength={10}
                placeholder="Enter mobile number"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value.replace(/\D/g, "").slice(0, 10));
                  if (inlineError) setInlineError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !submitting) submit();
                }}
                aria-invalid={!!inlineError}
                aria-describedby={inlineError ? "checkout-phone-error" : undefined}
                className="flex-1 bg-transparent outline-none text-[14px]"
                autoComplete="tel-national"
              />
            </div>
            {inlineError && (
              <p id="checkout-phone-error" className="text-[12px] font-medium text-red-600 -mt-1">
                {inlineError}
              </p>
            )}

            <Button
              onClick={submit}
              disabled={submitting}
              className="w-full h-12 text-[15px] font-bold bg-black hover:bg-black/90 text-white disabled:bg-black disabled:text-white disabled:opacity-100 rounded-lg"
            >
              {submitting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                "Continue"
              )}
            </Button>
          </div>
        </div>



        {/* Trust footer */}
        <div className="pt-6 pb-2 text-center">
          <div className="text-[11px] text-muted-foreground mb-1">
            Powered by
          </div>
          <div className="inline-flex items-center justify-center gap-1.5 text-[14px] font-bold tracking-tight">
            <img src={shopbanaoLogo} alt="ShopBanao" className="h-5 w-5 inline-block object-contain" loading="lazy" width="20" height="20" />
            ShopBanao
          </div>
          <div className="text-[12px] text-muted-foreground mt-3">
            Powering secure checkout for 10,000+ brands
          </div>
          <div className="flex items-center justify-center gap-4 mt-3 text-muted-foreground">
            <div className="flex items-center gap-1 text-[11px]">
              <ShieldCheck className="h-4 w-4" /> PCI DSS
              <br />
              Certified
            </div>
            <div className="flex items-center gap-1 text-[11px]">
              <Lock className="h-4 w-4" /> Secured
              <br />
              Payments
            </div>
            <div className="flex items-center gap-1 text-[11px]">
              <CheckCircle2 className="h-4 w-4" /> Verified
              <br />
              Merchant
            </div>
          </div>
        </div>
      </div>

      {/* Sticky bottom: consent + Continue */}
      <div
        className="fixed bottom-0 left-0 right-0 z-[1000] max-w-md mx-auto bg-white border-t border-[#ECECEC] p-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] shadow-[0_-4px_16px_rgba(0,0,0,0.06)]"
        style={{ bottom: keyboardInset ? `${keyboardInset}px` : undefined }}
      >
        <label className="flex items-center gap-2 pb-2 text-[12px]">
          <Checkbox
            checked={consent}
            onCheckedChange={(v) => setConsent(v === true)}
          />
          <span>Send me order updates &amp; offers - (no spam)</span>
        </label>
        <Button
          onClick={submit}
          disabled={submitting || !valid}
          className="w-full h-12 text-[15px] font-bold bg-black hover:bg-black/90 text-white disabled:bg-black disabled:text-white disabled:opacity-100 rounded-lg"
        >
          {submitting ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            "Continue"
          )}
        </Button>
        <div className="text-[10px] text-center text-muted-foreground mt-1.5">
          By proceeding, I agree to the store's Privacy Policy and T&amp;C
        </div>
      </div>
    </div>
  );
}
