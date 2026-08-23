/**
 * BuyNowPhoneModal — Phone-only Quick Buy lead capture.
 *
 * Flow:
 *  1. Shopper taps "Buy Now" on a PDP.
 *  2. We open this modal asking for a 10-digit phone.
 *  3. On submit:
 *     - Save a lead row in `customer_leads` for this store (shows in dashboard
 *       → Customer Leads). Fire-and-forget; never blocks navigation.
 *     - Persist phone in localStorage so the checkout page auto-fills it.
 *     - Auto-login the shopper by phone (`create-guest-account` edge fn) so
 *       checkout treats them as a logged-in customer.
 *     - Navigate to checkout.
 *  4. If a valid phone is already in localStorage (returning shopper), the
 *     modal is skipped entirely and we go straight to checkout (Quick Buy).
 *
 * IMPORTANT: no geolocation, no reverse-geocode, no Google Maps API.
 * City/address are typed by the shopper on the checkout page.
 */
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { IndiaFlagIcon } from "@/components/ui/IndiaFlagIcon";
import { Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { storefrontPath } from "@/lib/subdomain";
import { supabase } from "@/integrations/supabase/client";
import { supabaseStorefront } from "@/integrations/supabase/storefrontClient";
import { normalizePhone, isValidIndianPhone } from "@/lib/phoneUtils";
import { setCapiUser } from "@/lib/metaEnrichment";

/**
 * The mobile number is the ONLY identifier this storefront collects before
 * checkout (we never ask for email). Push it into Pixel Advanced Matching +
 * the CAPI registry the instant it's captured, so the InitiateCheckout that
 * fires seconds later on the checkout page already carries a `ph` match key.
 */
function seedPhoneForMeta(phone: string) {
  try {
    const digits = String(phone).replace(/\D/g, "");
    if (digits.length >= 10) setCapiUser({ phone: digits });
  } catch { /* noop */ }
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeSlug: string;
  /** Store ID — required to save lead to customer_leads */
  storeId?: string;
  /** Optional product context attached to the lead */
  productId?: string;
  productName?: string;
  /** Variant + quantity so checkout can enter single-product mode */
  variantId?: string;
  quantity?: number;
  /** Source label saved in customer_leads.source (default: 'quick_buy') */
  source?: string;
  /** Called before navigating — lets parent add item to cart etc. */
  onBeforeNavigate?: () => void;
}

/**
 * Save the captured phone as a lead immediately (fire-and-forget).
 *
 * Uses `capture_checkout_lead` (NOT a raw insert) so this shares the same
 * store+phone dedupe window as checkout step 1 / checkout v2. A raw insert
 * here used to produce a second/third duplicate lead row for the same shopper
 * within minutes.
 */
async function saveLead(opts: {
  storeId?: string;
  phone: string;
  productId?: string;
  productName?: string;

  source: string;
}) {
  if (!opts.storeId) return;
  try {
    await (supabase as any).rpc("capture_checkout_lead", {
      p_store_id: opts.storeId,
      p_phone: opts.phone,
      p_cart_items: opts.productId
        ? [{ productId: opts.productId, name: opts.productName ?? null, quantity: 1 }]
        : [],
      p_consent: true,
      p_session_token: null,
      p_source: opts.source,
    });
  } catch (err) {
    console.warn("[BuyNow] Lead save failed:", err);
  }
}

/** Phone-only auto-login: creates/locates a storefront customer and sets the session. */
async function autoLoginByPhone(storeId: string | undefined, phone: string) {
  if (!storeId) return;
  try {
    const { data, error } = await supabase.functions.invoke("create-guest-account", {
      body: { phone, store_id: storeId },
    });
    if (error) {
      console.warn("[BuyNow] auto-login error:", error.message);
      return;
    }
    const result = data as { session?: { access_token?: string; refresh_token?: string } } | null;
    if (result?.session?.access_token && result?.session?.refresh_token) {
      // Storefront-isolated client — keeps customer session separate from
      // merchant/admin dashboard session in the same browser.
      await supabaseStorefront.auth.setSession({
        access_token: result.session.access_token,
        refresh_token: result.session.refresh_token,
      });
    }
  } catch (err) {
    console.warn("[BuyNow] auto-login failed:", err);
  }
}

export default function BuyNowPhoneModal({
  open,
  onOpenChange,
  storeSlug,
  storeId,
  productId,
  productName,
  source = "quick_buy",
  variantId,
  quantity = 1,
  onBeforeNavigate,
}: Props) {
  const navigate = useNavigate();
  const didSkip = useRef(false);
  const autoSubmittedRef = useRef(false);
  const inFlightRef = useRef(false);
  const [phone, setPhone] = useState(() => {
    try {
      const saved = localStorage.getItem("checkout_phone") || "";
      return saved.replace(/\D/g, "").slice(0, 10);
    } catch {
      return "";
    }
  });
  const [inlineError, setInlineError] = useState<string | null>(null);


  /** Buy Now must check out ONLY this product, never the whole cart. */
  const checkoutHref = () => {
    if (!productId) return storefrontPath(storeSlug, "checkout");
    const qs = new URLSearchParams();
    qs.set("product", productId);
    if (variantId) qs.set("variant", variantId);
    if (quantity > 1) qs.set("qty", String(quantity));
    return storefrontPath(storeSlug, `checkout?${qs.toString()}`);
  };

  const digits = phone.replace(/\D/g, "");
  const valid = digits.length === 10 && /^[6-9]/.test(digits);

  // If phone already saved, skip modal and go direct to checkout
  useEffect(() => {
    if (!open || didSkip.current) return;
    try {
      const saved = localStorage.getItem("checkout_phone");
      const normalized = normalizePhone(saved);
      if (normalized && isValidIndianPhone(normalized)) {
        didSkip.current = true;
        try { localStorage.setItem("checkout_phone", normalized); } catch {}
        seedPhoneForMeta(normalized);
        saveLead({ storeId, phone: normalized, productId, productName, source });
        void autoLoginByPhone(storeId, normalized);
        onBeforeNavigate?.();
        onOpenChange(false);
        navigate(checkoutHref());
      }
    } catch {}
  }, [open]);

  // Reset skip flag when modal closes
  useEffect(() => {
    if (!open) {
      didSkip.current = false;
      autoSubmittedRef.current = false;
      setInlineError(null);
    }
  }, [open]);

  const handleContinue = () => {
    if (inFlightRef.current) return;
    if (digits.length < 10) {
      setInlineError("Please enter your full 10-digit mobile number");
      return;
    }
    const normalized = normalizePhone(digits);
    if (!isValidIndianPhone(normalized)) {
      setInlineError("Enter a valid Indian mobile number starting with 6-9");
      return;
    }
    setInlineError(null);
    inFlightRef.current = true;

    try { localStorage.setItem("checkout_phone", normalized); } catch {}

    seedPhoneForMeta(normalized);
    saveLead({ storeId, phone: normalized, productId, productName, source });
    void autoLoginByPhone(storeId, normalized);

    onBeforeNavigate?.();
    onOpenChange(false);
    navigate(checkoutHref());
  };

  // Auto-submit the moment a valid 10-digit number is entered (Gokwik-style).
  useEffect(() => {
    if (!open) return;
    if (valid && !autoSubmittedRef.current) {
      autoSubmittedRef.current = true;
      const t = window.setTimeout(() => handleContinue(), 120);
      return () => window.clearTimeout(t);
    }
    if (!valid) autoSubmittedRef.current = false;
  }, [valid, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sfg sfg-panel sfg-strong max-w-sm mx-auto">
        <DialogHeader>
          <DialogTitle className="text-center text-lg font-bold">
            Enter your mobile number
          </DialogTitle>
          <DialogDescription className="text-center text-sm" style={{ color: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 60%, transparent)" }}>
            We'll use this to confirm your order
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          <div
            className={`flex items-center h-12 rounded-xl border-2 px-3 gap-2 transition-colors ${
              inlineError ? "border-red-500" : "border-slate-200 focus-within:border-slate-400"
            }`}
          >
            <IndiaFlagIcon className="h-4 w-[22px] rounded-[2px] shadow-[0_0_0_1px_rgba(0,0,0,0.08)]" />
            <span className="text-sm font-medium text-slate-700">+91</span>
            <span className="text-slate-300">|</span>
            <Input
              type="tel"
              inputMode="numeric"
              maxLength={10}
              placeholder="Enter 10-digit number"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value.replace(/\D/g, "").slice(0, 10));
                if (inlineError) setInlineError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleContinue();
              }}
              aria-invalid={!!inlineError}
              className="flex-1 border-0 shadow-none focus-visible:ring-0 px-0 h-8 text-base font-medium"
              autoFocus
            />
          </div>
          {inlineError && (
            <p className="text-[12px] font-medium text-red-600">{inlineError}</p>
          )}

          <div className="flex items-center justify-center gap-4 text-xs" style={{ color: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 60%, transparent)" }}>
            <span className="flex items-center gap-1">
              <Lock className="h-3.5 w-3.5" />
              Secure checkout
            </span>
            <span className="flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5" />
              Privacy protected
            </span>
          </div>

          <Button
            onClick={handleContinue}
            className="w-full h-12 rounded-xl text-sm font-bold uppercase tracking-wider"
          >
            Continue to Checkout
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
