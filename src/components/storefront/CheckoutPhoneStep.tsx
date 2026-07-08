/**
 * CheckoutPhoneStep — Step 1 of the 2-step checkout.
 *
 * Captures the shopper's phone number BEFORE the address/payment step so:
 *   1. We seed the address form with an auto-created guest account.
 *   2. The number is stored as a lead + abandoned_carts row for WA recovery.
 *
 * UI matches the GoKwik-style checkout (Order Summary → Offers → Login card).
 * Logic (capture_checkout_lead RPC + autoLoginByPhone) is unchanged.
 */
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  Loader2,
  Lock,
  ShieldCheck,
  CheckCircle2,
  Trash2,
  UserCircle2,
  ShoppingCart,
} from "lucide-react";
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
  storeLogo?: string;
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
  storeLogo,
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
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [couponDraft, setCouponDraft] = useState<string>("");
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
        localStorage.setItem("checkout_phone", canon);
        if (couponDraft.trim()) {
          localStorage.setItem("checkout_coupon_draft", couponDraft.trim().toUpperCase());
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

      void autoLoginByPhone(storeId, canon);
      onComplete(canon);
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

  return (
    <div className="mx-auto max-w-md min-h-screen bg-[#F5F5F5] pb-[220px]">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-white border-b border-[#ECECEC] px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => window.history.back()}
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

      {/* Announcement bar */}
      <div className="sticky top-[57px] z-10 bg-black text-white text-[13px] font-semibold text-center py-2.5 px-4">
        Unlock Extra Discount In Next Step
      </div>

      <div className="px-3 py-3 space-y-3">
        {/* Order Summary card */}
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
                    <div className="line-clamp-2 text-[13px] font-semibold">
                      {i.name || "Item"}
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      Qty: {i.quantity || 1}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <span className="text-[13px] font-semibold tabular-nums">
                      {formatPrice(
                        (Number(i.price) || 0) * (Number(i.quantity) || 1),
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeFromCart(i.productId, i.variantId)}
                      className="flex items-center gap-1 text-[11px] text-muted-foreground transition hover:text-destructive"
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
        </div>

        {/* Offers card */}
        <div className="bg-white rounded-xl border border-[#ECECEC] overflow-hidden">
          <div className="bg-emerald-50 text-emerald-700 text-[13px] font-semibold text-center py-2">
            You save on next step
          </div>
          <div className="p-3.5">
            <Input
              value={couponDraft}
              onChange={(e) => setCouponDraft(e.target.value.toUpperCase())}
              placeholder="Enter coupon code"
              className="h-11 rounded-lg border-[#ECECEC] uppercase"
            />
            <div className="mt-2 text-[11px] text-muted-foreground">
              Coupons will be applied on the next step.
            </div>
          </div>
        </div>

        {/* Mobile number card */}
        <div className="bg-white rounded-xl border border-[#ECECEC] overflow-hidden">
          <div className="p-3.5 space-y-3">
            <div className="text-[14px] font-semibold">Enter your mobile number</div>
            <div className="text-[11px] text-muted-foreground -mt-2">
              We'll use this to send order updates. No OTP required.
            </div>
            <div className="relative">
              <Label className="text-[11px] text-muted-foreground absolute -top-2 left-3 bg-white px-1">
                Mobile Number
              </Label>
              <div className="flex items-center h-12 rounded-lg border border-[#ECECEC] px-3 gap-2">
                <span className="text-[14px] font-medium">+91</span>
                <span className="text-muted-foreground">|</span>
                <input
                  id="checkout-phone-input"
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="Enter Mobile Number"
                  value={phone}
                  onChange={(e) =>
                    setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && valid && !submitting) submit();
                  }}
                  className="flex-1 bg-transparent outline-none text-[14px]"
                  autoComplete="tel-national"
                />
              </div>
            </div>
          </div>
        </div>


        {/* Trust footer */}
        <div className="pt-6 pb-2 text-center">
          <div className="text-[11px] text-muted-foreground mb-1">
            Powered by
          </div>
          <div className="text-[14px] font-bold tracking-tight">
            {storeName || "Storivo"}
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
      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-[#ECECEC] p-3">
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
          className="w-full h-12 text-[15px] font-bold bg-black hover:bg-black/90 disabled:bg-gray-300 disabled:text-white disabled:opacity-100 rounded-lg"
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

// Local Label to avoid extra shadcn import weight
function Label({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <label className={className}>{children}</label>;
}
