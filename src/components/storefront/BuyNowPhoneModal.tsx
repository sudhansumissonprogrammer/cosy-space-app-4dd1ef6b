/**
 * BuyNowPhoneModal — Theme 16 exclusive.
 * Collects phone, triggers geolocation + reverse-geocode,
 * saves to localStorage, then redirects to checkout.
 * If phone already saved, skips modal and goes direct to checkout (Quick Buy).
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
import { Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { storefrontPath } from "@/lib/subdomain";
import { supabase } from "@/integrations/supabase/client";
import { supabaseStorefront } from "@/integrations/supabase/storefrontClient";
import { normalizePhone, isValidIndianPhone } from "@/lib/phoneUtils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeSlug: string;
  /** Store ID — required to save lead to customer_leads */
  storeId?: string;
  /** Optional product context attached to the lead */
  productId?: string;
  productName?: string;
  /** Source label saved in customer_leads.source (default: 'quick_buy') */
  source?: string;
  /** Called before navigating — lets parent add item to cart etc. */
  onBeforeNavigate?: () => void;
}

/** Save the captured phone as a lead immediately (fire-and-forget). */
async function saveLead(opts: {
  storeId?: string;
  phone: string;
  productId?: string;
  productName?: string;
  source: string;
}) {
  if (!opts.storeId) return;
  try {
    await supabase.from("customer_leads").insert({
      store_id: opts.storeId,
      phone: opts.phone,
      product_id: opts.productId ?? null,
      product_name: opts.productName ?? null,
      source: opts.source,
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

/** Fire-and-forget geolocation + reverse geocode */
function triggerGeolocation() {
  if (!("geolocation" in navigator)) {
    console.warn("[BuyNow] Geolocation not available");
    return;
  }

  const doGeocode = async (pos: GeolocationPosition) => {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(`${supabaseUrl}/functions/v1/reverse-geocode`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
        },
        body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      });
      const data = await res.json();
      if (data?.success && data?.address) {
        localStorage.setItem("checkout_address", JSON.stringify(data.address));
        console.log("[BuyNow] Address saved:", data.address);
      }
    } catch (err) {
      console.warn("[BuyNow] Geocode failed:", err);
    }
  };

  navigator.geolocation.getCurrentPosition(
    (pos) => doGeocode(pos),
    () => {
      navigator.geolocation.getCurrentPosition(
        (pos) => doGeocode(pos),
        (err2) => console.warn("[BuyNow] All geo failed:", err2.message),
        { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 }
      );
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 600000 }
  );
}

export default function BuyNowPhoneModal({
  open,
  onOpenChange,
  storeSlug,
  storeId,
  productId,
  productName,
  source = "quick_buy",
  onBeforeNavigate,
}: Props) {
  const navigate = useNavigate();
  const didSkip = useRef(false);
  const [phone, setPhone] = useState(() => {
    try {
      return localStorage.getItem("checkout_phone") || "";
    } catch {
      return "";
    }
  });

  // If phone already saved, skip modal and go direct to checkout
  useEffect(() => {
    if (!open || didSkip.current) return;
    try {
      const saved = localStorage.getItem("checkout_phone");
      const normalized = normalizePhone(saved);
      if (normalized && isValidIndianPhone(normalized)) {
        didSkip.current = true;
        // Persist normalized version going forward
        try { localStorage.setItem("checkout_phone", normalized); } catch {}
        saveLead({ storeId, phone: normalized, productId, productName, source });
        void autoLoginByPhone(storeId, normalized);
        onBeforeNavigate?.();
        onOpenChange(false);
        navigate(storefrontPath(storeSlug, "checkout"));
        triggerGeolocation();
      }
    } catch {}
  }, [open]);

  // Reset skip flag when modal closes
  useEffect(() => {
    if (!open) didSkip.current = false;
  }, [open]);

  const handleContinue = () => {
    const normalized = normalizePhone(phone);
    if (!isValidIndianPhone(normalized)) {
      toast.error("Please enter a valid 10-digit mobile number");
      return;
    }

    try { localStorage.setItem("checkout_phone", normalized); } catch {}

    // Save lead immediately so it shows up in dashboard → Leads
    saveLead({ storeId, phone: normalized, productId, productName, source });
    // Auto-login the shopper by phone so checkout sees a logged-in customer
    void autoLoginByPhone(storeId, normalized);

    onBeforeNavigate?.();
    onOpenChange(false);
    navigate(storefrontPath(storeSlug, "checkout"));
    triggerGeolocation();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm mx-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-center text-lg font-bold">
            Enter your mobile number
          </DialogTitle>
          <DialogDescription className="text-center text-sm" style={{ color: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 60%, transparent)" }}>
            We'll use this to confirm your order
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium" style={{ color: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 60%, transparent)" }}>
              +91
            </span>
            <Input
              type="tel"
              inputMode="numeric"
              maxLength={10}
              placeholder="Enter 10-digit number"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
              className="pl-12 h-12 text-base rounded-xl"
              autoFocus
            />
          </div>

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
            disabled={phone.replace(/\D/g, "").length !== 10}
            className="w-full h-12 rounded-xl text-sm font-bold uppercase tracking-wider"
          >
            Continue to Checkout
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
