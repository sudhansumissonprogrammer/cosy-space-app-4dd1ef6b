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
import secureBadge from "@/assets/trust/secure-payment-badge.webp.asset.json";
import trustedSellerBadge from "@/assets/trust/trusted-seller-badge-v3.webp.asset.json";
import {
  ArrowLeft,
  ChevronDown,
  Loader2,
  Lock,
  ShieldCheck,
  CheckCircle2,
  Headset,
  Trash2,
  ShoppingCart,
  Minus,
  Plus,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { IndiaFlagIcon } from "@/components/ui/IndiaFlagIcon";
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
import { useStorefrontThemeConfig } from "@/hooks/useStorefrontThemeConfig";
import { setCapiUser } from "@/lib/metaEnrichment";
import { fbPixelTrack, generateEventId } from "@/hooks/useFacebookPixel";
import { fireMetaCAPI } from "@/lib/metaCapi";
import CheckoutOtpSheet from "@/components/storefront/CheckoutOtpSheet";

interface Props {
  storeId?: string;
  storeSlug?: string;
  storeName?: string;
  storeLogo?: string;
  /** Store owner / customer-care number shown in the header (same as payment step). */
  storePhone?: string | null;
  cartItems: CartItem[];
  /** True when in buy-now single mode — hides Remove (no cart to fall back to). */
  isSingleMode?: boolean;
  /** Called when the shopper taps +/- on a row. Parent decides cart vs buy-now qty. */
  onQuantityChange?: (item: CartItem, nextQty: number) => void;
  /** Called when the shopper taps Remove. Parent removes + navigates if cart empties. */
  onRemoveItem?: (item: CartItem) => void;
  /** Parent-owned exit handler so header back follows the checkout save-offer flow. */
  onBack?: () => void;
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
  storePhone,
  cartItems,
  isSingleMode,
  onQuantityChange,
  onRemoveItem,
  onBack,
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
  
  const inFlight = useRef(false);
  
  const themeConfig = useStorefrontThemeConfig(storeId);

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

  // Coupon preview BEFORE the shopper commits their phone so the discount
  // feels earned. We look at BOTH the store-wide auto-apply coupon and the
  // exclusive (WhatsApp) coupon and advertise whichever saves more — the
  // exclusive one is what checkout ends up applying on the exit offer.
  type CouponRow = {
    code: string;
    discount_type: string;
    discount_value: number;
    min_order_amount?: number | null;
  };
  const [autoCoupon, setAutoCoupon] = useState<CouponRow | null>(null);
  const [exclusiveCoupon, setExclusiveCoupon] = useState<CouponRow | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!storeId) return;
    (async () => {
      const first = <T,>(d: any): T | null => (Array.isArray(d) ? d[0] ?? null : d ?? null);
      try {
        const { data } = await (supabase as any).rpc(
          "get_store_auto_apply_coupon",
          { _store_id: storeId },
        );
        if (!cancelled) setAutoCoupon(first<CouponRow>(data));
      } catch {}
      try {
        const { data } = await (supabase as any).rpc("get_store_wa_coupon", {
          _store_id: storeId,
        });
        if (!cancelled) setExclusiveCoupon(first<CouponRow>(data));
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [storeId]);

  const valueOf = (c: CouponRow | null) => {
    if (!c || subtotal <= 0) return 0;
    if (subtotal < Number(c.min_order_amount || 0)) return 0;
    const raw =
      c.discount_type === "percentage"
        ? (subtotal * Number(c.discount_value || 0)) / 100
        : Number(c.discount_value || 0);
    return Math.max(0, Math.min(raw, subtotal));
  };

  const { bestCoupon, autoCouponDiscount } = useMemo(() => {
    const a = valueOf(autoCoupon);
    // The exclusive coupon is only advertised to shoppers who actually
    // claimed it from the exit-intent popup.
    const claimed = (() => {
      try { return sessionStorage.getItem(`sf_exit_claimed_${storeId || "x"}`); } catch { return null; }
    })();
    const e =
      claimed && exclusiveCoupon?.code &&
      claimed.toUpperCase() === String(exclusiveCoupon.code).toUpperCase()
        ? valueOf(exclusiveCoupon)
        : 0;
    return e > a
      ? { bestCoupon: exclusiveCoupon, autoCouponDiscount: e }
      : { bestCoupon: autoCoupon, autoCouponDiscount: a };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCoupon, exclusiveCoupon, subtotal, storeId]);


  const setQty = (item: CartItem, next: number) => {
    const n = Math.max(1, Math.min(99, Math.floor(next)));
    onQuantityChange?.(item, n);
  };

  // ── Mobile-number verification (opt-in per store) ────────────────────────
  // Default OFF. Only stores that switch it on in Settings ever see the OTP
  // screen; every other store keeps the exact previous checkout flow.
  const [otpRequired, setOtpRequired] = useState(false);
  const [otpPhone, setOtpPhone] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!storeId) return;
    // Cache per tab so a shopper bouncing between cart and checkout doesn't
    // repeat this lookup. Any failure keeps the previous behaviour (no OTP).
    const cacheKey = `sb_otp_flag:${storeId}`;
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached === "1" || cached === "0") {
        setOtpRequired(cached === "1");
        return;
      }
    } catch { /* private mode */ }
    (async () => {
      try {
        const { data } = await (supabase as any).rpc("get_store_checkout_otp", {
          _store_id: storeId,
        });
        const on = data === true;
        try { sessionStorage.setItem(cacheKey, on ? "1" : "0"); } catch {}
        if (!cancelled) setOtpRequired(on);
      } catch {
        /* flag unavailable → behave exactly as before (no OTP) */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storeId]);

  const verifiedKey = (canon: string) => `sb_otp_ok:${storeId}:${canon}`;
  const isAlreadyVerified = (canon: string) => {
    try {
      const raw = localStorage.getItem(verifiedKey(canon));
      return !!raw && Date.now() - Number(raw) < 30 * 24 * 60 * 60 * 1000;
    } catch {
      return false;
    }
  };

  /** Everything that used to run straight after tapping Continue. */
  const proceed = (canon: string) => {
    try {
      localStorage.setItem("checkout_phone", canon);
    } catch {}

    // EMQ lift: seed Meta Advanced Matching + CAPI registry with the
    // phone RIGHT NOW so InitiateCheckout / AddPaymentInfo events fired
    // moments later ship with hashed phone in user_data.
    try {
      setCapiUser({ phone: canon });
    } catch {}

    // Lead — fired once per phone per session with a shared event_id so the
    // browser and server events deduplicate.
    try {
      const leadKey = `sb_lead_fired:${storeId}:${canon}`;
      const alreadyFired = (() => {
        try { return sessionStorage.getItem(leadKey) === "1"; } catch { return false; }
      })();
      if (storeId && !alreadyFired) {
        try { sessionStorage.setItem(leadKey, "1"); } catch {}
        const leadValue = cartItems.reduce(
          (s, i) => s + (Number(i.price) || 0) * (Number(i.quantity) || 1),
          0,
        );
        const eid = generateEventId();
        fbPixelTrack("Lead", { content_name: "checkout_phone", currency: "INR", value: leadValue }, eid);
        fireMetaCAPI({
          storeId,
          eventName: "Lead",
          eventId: eid,
          userPhone: canon,
          customData: { content_name: "checkout_phone", currency: "INR", value: leadValue },
        });
      }
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

    // ⚡ INSTANT ADVANCE: neither the lead capture nor the guest-session
    // mint blocks the shopper.
    (async () => {
      try {
        const { data: rpcData } = await (supabase as any).rpc("capture_checkout_lead", {
          p_store_id: storeId,
          p_phone: canon,
          p_cart_items: cartSnapshot,
          p_consent: consent,
          p_session_token: session_token,
          p_source: "checkout_step1",
        });
        const cartId = (rpcData as any)?.cart_id;
        if (cartId && storeId) {
          sessionStorage.setItem(`ac_${storeId}`, String(cartId));
        }
      } catch { /* noop */ }
    })();

    autoLoginByPhone(storeId, canon).catch(() => null);
    onComplete(canon, null);
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
      if (otpRequired && storeId && !isAlreadyVerified(canon)) {
        // Open the verification sheet INSTANTLY — the WhatsApp code is
        // requested from inside the sheet, so there is no waiting spinner
        // on this screen.
        setOtpPhone(canon);
        return;
      }

      proceed(canon);
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

  // NOTE: auto-submit on the 10th digit was removed intentionally.
  // It closed the keyboard the instant a number was typed, so shoppers never
  // got a chance to re-read it → wrong numbers → undeliverable parcels.
  // The shopper must now tap Continue after verifying the number.



  // Rendered as an overlay so the checkout page stays visible behind it.
  const otpOverlay = otpPhone ? (
    <CheckoutOtpSheet
      storeId={storeId!}
      phone={otpPhone}
      onEdit={() => setOtpPhone(null)}
      onSendFailed={(message) => {
        // Delivery problem — never dead-end a paying shopper.
        console.warn("[CheckoutPhoneStep] OTP send failed", message);
        const canon = otpPhone;
        setOtpPhone(null);
        toast.error("Could not send the WhatsApp code. Continuing without verification.");
        proceed(canon);
      }}
      onVerified={() => {

        try {
          localStorage.setItem(verifiedKey(otpPhone), String(Date.now()));
        } catch {}
        const canon = otpPhone;
        setOtpPhone(null);
        proceed(canon);
      }}
    />
  ) : null;

  return (
    <div className="mx-auto max-w-md min-h-screen bg-[#F5F5F5] pb-10">
      {otpOverlay}
      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-white border-b border-[#ECECEC] px-3 py-1 flex items-center gap-2">
        <button
          onClick={() => {
            if (onBack) {
              onBack();
              return;
            }
            try {
              if (window.history.length > 1) {
                window.history.back();
                return;
              }
            } catch {}
            window.location.href = storefrontPath(storeSlug || "");
          }}
          aria-label="Back"
          className="p-1 -ml-1 shrink-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <div className="flex min-w-0 flex-1 flex-col justify-center">
          {storeLogo ? (
            <img
              src={storeLogo}
              alt={storeName || "Store logo"}
              className="h-8 w-auto max-w-[120px] self-start object-contain"
            />
          ) : (
            <div className="text-[15px] font-bold leading-tight truncate">
              {storeName || "Store"}
            </div>
          )}
          {storePhone && (
            <a
              href={`tel:${String(storePhone).replace(/\s/g, "")}`}
              className="mt-0.5 inline-flex items-center gap-1 text-[11px] leading-none text-muted-foreground hover:text-foreground transition-colors"
              aria-label={`Customer care ${storePhone}`}
            >
              <Headset className="h-3 w-3" />
              <span className="truncate">{storePhone}</span>
            </a>
          )}
        </div>


        <div className="flex items-center -space-x-2">
          <img
            src={trustedSellerBadge.url}
            alt="Trusted Seller"
            width={622}
            height={300}
            decoding="async"
            className="h-[60px] w-auto shrink-0 object-contain"
          />
          <img
            src={secureBadge.url}
            alt="100% Secure Payment"
            width={110}
            height={50}
            decoding="async"
            className="h-[30px] w-auto shrink-0 object-contain"
          />
        </div>
      </div>




      <div className="px-3 py-3 space-y-3">
        {/* Best-available coupon reward banner — advertises the biggest
            saving (exclusive coupon wins over the store-wide auto one). */}
        {autoCouponDiscount > 0 && bestCoupon && (
          <div
            className="rounded-xl border overflow-hidden"
            style={{
              borderColor: "color-mix(in srgb, var(--storefront-primary, hsl(var(--primary))) 26%, transparent)",
              background: "color-mix(in srgb, var(--storefront-primary, hsl(var(--primary))) 6%, #fff)",
            }}
          >
            <div
              className="flex items-center gap-2.5 px-3.5 py-2.5"
              style={{
                background: "var(--storefront-primary, hsl(var(--primary)))",
                color: "var(--storefront-btn-text, #fff)",
              }}
            >
              <Sparkles className="h-4 w-4 shrink-0" strokeWidth={2.6} />
              <div className="text-[12.5px] font-extrabold leading-tight tracking-tight flex-1">
                You got {formatPrice(autoCouponDiscount)} off!
              </div>
              <span className="text-[10.5px] font-bold bg-white/20 px-2 py-0.5 rounded">
                {bestCoupon.code}
              </span>
            </div>
            <div className="px-3.5 py-2 text-[11.5px] leading-snug opacity-80">
              Coupon <span className="font-bold">{bestCoupon.code}</span> auto-applied · Enter your mobile number to claim
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
              <IndiaFlagIcon className="h-3.5 w-5 rounded-[2px] shadow-[0_0_0_1px_rgba(0,0,0,0.06)]" />
              <span className="text-[14px] font-medium">+91</span>
              <span className="text-muted-foreground">|</span>
              <input
                id="checkout-phone-input"
                name="tel-national"
                autoComplete="tel-national"
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
              />
            </div>
            {inlineError && (
              <p id="checkout-phone-error" className="text-[12px] font-medium text-red-600 -mt-1">
                {inlineError}
              </p>
            )}

            {/* Re-verify nudge — wrong numbers are the #1 cause of failed
                deliveries + failed WhatsApp order updates. Shown in English
                + short Hindi, and highlighted once 10 digits are entered. */}
            <div
              className={`rounded-lg border px-3 py-2 -mt-1 ${
                valid
                  ? "border-amber-300 bg-amber-50"
                  : "border-[#ECECEC] bg-[#FAFAFA]"
              }`}
            >
              <div className={`text-[12px] font-bold leading-snug ${valid ? "text-amber-900" : "text-foreground"}`}>
                Please re-check your mobile number
              </div>
              <div className={`text-[11.5px] leading-snug mt-0.5 ${valid ? "text-amber-800" : "text-muted-foreground"}`}>
                Wrong number = parcel will not be delivered.
              </div>
              <div className={`text-[11.5px] leading-snug mt-0.5 ${valid ? "text-amber-800" : "text-muted-foreground"}`}>
                नंबर एक बार दोबारा जाँच लें — गलत नंबर पर पार्सल नहीं पहुँचेगा।
              </div>
            </div>


            <label className="flex items-center gap-2 text-[12px]">
              <Checkbox
                checked={consent}
                onCheckedChange={(v) => setConsent(v === true)}
              />
              <span>Send me order updates &amp; offers - (no spam)</span>
            </label>

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
            <div className="text-[10px] text-center text-muted-foreground -mt-1">
              By proceeding, I agree to the store's Privacy Policy and T&amp;C
            </div>
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
            🔒 Your payment is securely processed by ShopBanao
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
    </div>
  );
}
