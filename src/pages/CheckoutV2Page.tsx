// CheckoutV2 — GoKwik-style 1-page checkout with direct UPI app tiles.
//
// Rendered ONLY when the URL has ?v2=1 OR the store has `checkout_v2_enabled=true`
// (see gating in src/pages/CheckoutPage.tsx). All existing checkout flows remain
// the default and are completely untouched.
//
// Flow:
//   1. Shopper enters phone → name → address (auto-fill from pincode).
//   2. Tap "Continue to Pay" → creates order via `place-order` (status=pending)
//      AND fires 1 `create-upi-intent` call (re-schemed per app on the client).
//   3. Tap GPay/PhonePe/Paytm/Any-UPI tile → `location.href = intent_url` fires
//      synchronously → UPI app opens with amount pre-filled.
//   4. Waiting screen polls `order-payment-status` (+ live PSP verify) every ~2s
//      up to 4 min, and instant-rechecks on tab focus/visibility.
//   5. On success → run full post-order plumbing (Pixel, GA4, funnel, guest
//      account, address save, order notifications), then navigate to tracking.
import { useState, useEffect, useMemo, useRef } from "react";
import { useOutletContext, useSearchParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { supabaseStorefront } from "@/integrations/supabase/storefrontClient";
import { useCart } from "@/contexts/CartContext";
import { useStorefrontAuth } from "@/contexts/StorefrontAuthContext";
import { formatPrice } from "@/lib/productUtils";
import { normalizePhone, isValidIndianPhone } from "@/lib/phoneUtils";
import { storefrontPath } from "@/lib/subdomain";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, MapPin, ShieldCheck, CheckCircle2, ArrowLeft, Lock, Banknote } from "lucide-react";
import { toast } from "sonner";
import type { StoreData } from "@/layouts/StorefrontLayout";
import { fbPixelTrack, generateEventId } from "@/hooks/useFacebookPixel";
import { ga4Track } from "@/hooks/useGA4";
import { getMetaCookies } from "@/lib/metaCapi";
import { getVisitorId, getOrCreateSessionId } from "@/lib/visitorSession";
import { fireStorefrontEvent } from "@/lib/storefrontEvents";

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

/**
 * Rewrite a `upi://pay?...` URL to the app-specific deeplink so the target
 * app opens directly AND parses the payment intent.
 *
 * IMPORTANT: each app has its OWN path — using the wrong one opens the app
 * but drops the payment payload. Verified paths (Nov 2024):
 *   - GPay:    tez://upi/pay?...          (path = /upi/pay)
 *   - PhonePe: phonepe://pay?...          (NO /upi prefix)
 *   - Paytm:   paytmmp://pay?...          (NO /upi prefix)
 */
function schemeFor(app: UpiApp, url: string): string {
  if (!url) return url;
  if (app === "any") return url;
  const m = url.match(/^upi:\/\/[^?]*\?(.+)$/i);
  const query = m?.[1];
  if (!query) return url;
  if (app === "gpay") return `tez://upi/pay?${query}`;
  if (app === "phonepe") return `phonepe://pay?${query}`;
  if (app === "paytm") return `paytmmp://pay?${query}`;
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

  // ─── Store shipping + tax config (keys ALIGNED with CheckoutPage so cache is shared) ──
  const { data: shippingConfig } = useQuery({
    queryKey: ["storefront-shipping-config", store.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("store_shipping_config")
        .select("*")
        .eq("store_id", store.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 30 * 60 * 1000,
  });

  const { data: taxConfig } = useQuery({
    queryKey: ["store-tax-config", store.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("store_tax_config")
        .select("*")
        .eq("store_id", store.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 30 * 60 * 1000,
  });

  // ─── Cart totals (mirror CheckoutPage math exactly) ─────────────────────
  const subtotal = useMemo(
    () => cartItems.reduce((s, i) => s + i.price * i.quantity, 0),
    [cartItems],
  );

  const shippingActive = shippingConfig?.is_active;
  const flatShippingRate = shippingActive ? Number(shippingConfig?.flat_rate) || 0 : 0;
  const freeShippingThreshold = shippingActive ? Number(shippingConfig?.free_shipping_above) || 0 : 0;
  const qualifiesForFreeShipping = shippingActive && freeShippingThreshold > 0 && subtotal >= freeShippingThreshold && flatShippingRate > 0;
  const shippingCharge = shippingActive ? (qualifiesForFreeShipping ? 0 : flatShippingRate) : 0;

  const taxActive = !!(taxConfig?.is_active && Number(taxConfig?.tax_rate) > 0);
  const taxRate = taxActive ? Number(taxConfig.tax_rate) : 0;
  const taxInclusive = taxConfig?.is_inclusive ?? false;
  const taxName = taxConfig?.tax_name || "Tax";
  let taxAmount = 0;
  if (taxActive) {
    if (taxInclusive) taxAmount = subtotal - (subtotal / (1 + taxRate / 100));
    else taxAmount = (subtotal * taxRate) / 100;
  }

  // ─── Coupon state (auto-apply from URL / storage — WhatsApp recovery flow) ──
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [couponDiscount, setCouponDiscount] = useState(0);
  const autoAppliedCouponRef = useRef(false);
  const urlCoupon =
    searchParams.get("coupon") ||
    (typeof window !== "undefined"
      ? sessionStorage.getItem("pending_coupon") || localStorage.getItem("pending_coupon")
      : null);

  useEffect(() => {
    if (!urlCoupon || autoAppliedCouponRef.current) return;
    if (!store?.id || subtotal <= 0 || appliedCoupon) return;
    autoAppliedCouponRef.current = true;
    const code = urlCoupon.toUpperCase();
    (async () => {
      try {
        const { data: rows } = await (supabase as any).rpc("validate_store_coupon", {
          _store_id: store.id,
          _code: code,
        });
        const data: any = Array.isArray(rows) ? rows[0] ?? null : rows ?? null;
        if (!data) return;
        const now = new Date();
        if (data.starts_at && new Date(data.starts_at) > now) return;
        if (data.expires_at && new Date(data.expires_at) < now) return;
        if (data.max_uses && data.used_count >= data.max_uses) return;
        if (subtotal < (data.min_order_amount || 0)) return;
        let discount = data.discount_type === "percentage"
          ? (subtotal * data.discount_value) / 100
          : data.discount_value;
        discount = Math.min(discount, subtotal);
        setAppliedCoupon(data);
        setCouponDiscount(discount);
        toast.success(`Coupon ${code} applied — you save ${formatPrice(discount, currency)}`);
      } catch { /* silent */ }
    })();
  }, [urlCoupon, store?.id, subtotal, appliedCoupon, currency]);

  const total = Math.max(0, subtotal + (taxInclusive ? 0 : taxAmount) + shippingCharge - couponDiscount);

  // ─── Store-level partial payment config ─────────────────────────────────
  const partialEnabled: boolean = (store as any)?.partial_payment_enabled ?? false;
  const partialType: string = (store as any)?.partial_payment_type || "percentage";
  const partialValue: number | null = (store as any)?.partial_payment_value ?? null;
  const hasPartial = partialEnabled && !!partialValue && Number(partialValue) > 0;

  // Partial advance — mirrors CheckoutPage.tsx (tax/shipping proportional, coupon proportional).
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
    const ratio = subtotal > 0 ? advance / subtotal : 1;
    advance += (taxInclusive ? 0 : taxAmount) * ratio + shippingCharge;
    advance -= couponDiscount * ratio;
    return Math.max(50, Math.min(total, Math.round(advance)));
  }, [cartItems, hasPartial, partialType, partialValue, subtotal, taxAmount, taxInclusive, shippingCharge, couponDiscount, total]);
  const partialBalanceDue = Math.max(0, total - partialAdvanceTotal);

  const [payMode, setPayMode] = useState<"full" | "partial">("partial");
  const effectiveMode: "full" | "partial" = hasPartial ? payMode : "full";
  const chargeAmount = effectiveMode === "partial" ? partialAdvanceTotal : total;

  // ─── Abandoned cart id (WhatsApp recovery attribution) ──────────────────
  const [abandonedCartId, setAbandonedCartId] = useState<string | null>(() => {
    try { return sessionStorage.getItem(`ac_${store.id}`); } catch { return null; }
  });
  useEffect(() => {
    if (abandonedCartId) return;
    if (cartItems.length === 0) return;
    const canonPhone = normalizePhone(phone);
    if (!canonPhone) return;
    (async () => {
      try {
        const { data } = await (supabase as any).rpc("capture_checkout_lead", {
          p_store_id: store.id,
          p_phone: canonPhone,
          p_cart_items: cartItems.map((i) => ({ name: i.name, price: i.price, quantity: i.quantity, productId: i.productId })),
          p_consent: true,
          p_session_token: null,
          p_source: "checkout_v2",
        });
        const cartId = (data as any)?.cart_id;
        if (cartId) {
          setAbandonedCartId(cartId);
          try { sessionStorage.setItem(`ac_${store.id}`, cartId); } catch { /* noop */ }
        }
      } catch { /* noop */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone, cartItems.length]);

  // ─── Order creation + intent generation ─────────────────────────────────
  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [showPayment, setShowPayment] = useState(false);

  const [intents, setIntents] = useState<Record<UpiApp, IntentState>>({
    gpay: { status: "idle" }, phonepe: { status: "idle" },
    paytm: { status: "idle" }, any: { status: "idle" },
  });

  // Gateway metadata captured from the intent response so the waiting screen
  // can actively verify with the PSP (not just poll the DB).
  const gatewayRef = useRef<{
    pg?: "cashfree" | "razorpay" | "payu";
    cf_order_id?: string;
    payu_txnid?: string;
    razorpay_payment_id?: string;
  }>({});

  // Meta / analytics signals — captured once per checkout session.
  const purchaseEventIdRef = useRef<string>(generateEventId());
  const metaCookiesRef = useRef<{ fbc: string; fbp: string }>(getMetaCookies());

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

  const buildPlaceOrderMeta = () => {
    // Sanitize event_source_url like CheckoutPage — strip query/fragment and
    // drop preview hosts so server CAPI falls back to the canonical URL.
    let safeUrl: string | undefined;
    try {
      const u = new URL(window.location.href);
      const h = u.hostname;
      const isPreview =
        h === "localhost" ||
        h === "127.0.0.1" ||
        h.endsWith(".lovableproject.com") ||
        h.endsWith(".lovable.dev") ||
        h.endsWith(".sandbox.lovable.dev");
      if (!isPreview) safeUrl = `${u.origin}${u.pathname}`;
    } catch { /* noop */ }
    return {
      event_id: purchaseEventIdRef.current,
      fbc: metaCookiesRef.current.fbc || undefined,
      fbp: metaCookiesRef.current.fbp || undefined,
      event_source_url: safeUrl,
    };
  };

  const buildAttribution = () => {
    try {
      const raw = sessionStorage.getItem("__sf_utm__");
      const utm = raw ? JSON.parse(raw) : {};
      const landing = sessionStorage.getItem("__sf_landing__") || null;
      const ref = document.referrer ? document.referrer.slice(0, 200) : null;
      return { ...utm, landing_path: landing, referrer: ref };
    } catch { return null; }
  };

  const buildPaymentReturnUrl = () => {
    try {
      const u = new URL(window.location.href);
      u.searchParams.delete("payu_status");
      u.searchParams.delete("txnid");
      u.searchParams.delete("payu_order");
      return u.toString();
    } catch {
      return `${window.location.origin}/checkout`;
    }
  };

  const createOrderAndIntents = async () => {
    const err = validateAddress();
    if (err) { toast.error(err); return; }
    if (cartItems.length === 0) { toast.error("Your cart is empty"); return; }

    setCreatingOrder(true);
    try {
      try {
        localStorage.setItem("checkout_phone", normalizePhone(phone));
        localStorage.setItem(`express_checkout_${store.id}`, JSON.stringify({
          fullName, email, pincode, streetAddress, city, state,
        }));
      } catch { /* noop */ }

      const orderNotes = appliedCoupon
        ? `Coupon: ${appliedCoupon.code} (-${formatPrice(couponDiscount, currency)})`
        : undefined;

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
            // Placeholder — the actual gateway is resolved by create-upi-intent's
            // fallback chain. The gateway-specific webhooks / verify functions
            // update `payment_method` server-side when they confirm the order.
            payment_method: "razorpay",
            notes: orderNotes,
            storefront_customer_id: customer?.id ?? null,
            payment_type: effectiveMode,
          },
          items: cartItems.map((it) => ({
            productId: it.productId,
            name: it.name,
            price: it.price,
            quantity: it.quantity,
          })),
          coupon_id: appliedCoupon?.id ?? null,
          abandoned_cart_id: abandonedCartId ?? null,
          meta: buildPlaceOrderMeta(),
          visitor_id: (() => { try { return getVisitorId(); } catch { return null; } })(),
          session_id: (() => { try { return getOrCreateSessionId(); } catch { return null; } })(),
          attribution: buildAttribution(),
        },
      });
      if (error) throw new Error(error.message);
      const result = data as { order_id?: string; order_number?: string; error?: string } | null;
      if (!result?.order_id) throw new Error(result?.error || "Failed to place order");

      setOrderId(result.order_id);
      setOrderNumber(result.order_number || null);
      setShowPayment(true);

      // ONE intent call (app-agnostic). See earlier commit — 4 parallel calls
      // caused Razorpay races, PayU duplicate-txnid errors, and Cashfree quota
      // burn. The `upi://` URL is app-agnostic; schemeFor rewrites it per app.
      const apps: UpiApp[] = ["gpay", "phonepe", "paytm", "any"];
      setIntents((s) => {
        const next = { ...s };
        apps.forEach((a) => { next[a] = { status: "loading" }; });
        return next;
      });

      try {
        const { data: intentData, error: intErr } = await supabase.functions.invoke("create-upi-intent", {
          body: {
            store_id: store.id,
            order_id: result.order_id,
            app: "any",
            customer_name: fullName.trim(),
            customer_phone: normalizePhone(phone),
            customer_email: email.trim() || undefined,
            return_url: buildPaymentReturnUrl(),
          },
        });
        const payload: any = intentData ?? (intErr as any)?.context?.body;
        const url: string | undefined = payload?.intent_url;
        if (!url) {
          const errMsg: string = payload?.error || intErr?.message || "Failed";
          setIntents((s) => {
            const next = { ...s };
            apps.forEach((a) => { next[a] = { status: "failed", error: errMsg }; });
            return next;
          });
        } else {
          if (payload?.pg) {
            gatewayRef.current = {
              pg: payload.pg,
              cf_order_id: payload.cf_order_id,
              payu_txnid: payload.payu_txnid,
              razorpay_payment_id: payload.razorpay_payment_id,
            };
          }
          setIntents((s) => {
            const next = { ...s };
            apps.forEach((a) => { next[a] = { status: "ready", url: schemeFor(a, url) }; });
            return next;
          });
        }
      } catch (e: any) {
        const msg = e?.message || "Failed";
        setIntents((s) => {
          const next = { ...s };
          apps.forEach((a) => { next[a] = { status: "failed", error: msg }; });
          return next;
        });
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to create order");
    } finally {
      setCreatingOrder(false);
    }
  };

  // ─── Post-order plumbing (Pixel / GA4 / funnel / notify / guest) ────────
  const finalizedOrderIdsRef = useRef<Set<string>>(new Set());

  const saveAddressToAccount = async () => {
    if (!customer?.id) return;
    try {
      const { data: existing } = await supabaseStorefront
        .from("customer_addresses")
        .select("id")
        .eq("storefront_customer_id", customer.id)
        .eq("street_address", streetAddress.trim())
        .eq("pincode", pincode.trim())
        .maybeSingle();
      if (existing) return;
      const { count } = await supabaseStorefront
        .from("customer_addresses")
        .select("id", { count: "exact", head: true })
        .eq("storefront_customer_id", customer.id);
      await supabaseStorefront.from("customer_addresses").insert({
        storefront_customer_id: customer.id,
        label: "Home",
        full_name: fullName.trim(),
        phone: normalizePhone(phone),
        street_address: streetAddress.trim(),
        city: city.trim(),
        state: state.trim(),
        pincode: pincode.trim(),
        is_default: (count ?? 0) === 0,
      });
    } catch (err) {
      console.error("Failed to save address to account:", err);
    }
  };

  const guestAccountPromiseRef = useRef<Promise<void> | null>(null);
  const createGuestAccount = (ordId: string) => {
    const p = (async () => {
      try {
        const { data } = await supabase.functions.invoke("create-guest-account", {
          body: {
            email: email.trim(),
            phone: normalizePhone(phone),
            name: fullName.trim(),
            store_id: store.id,
            order_id: ordId,
          },
        });
        const result = data as { session?: { access_token?: string; refresh_token?: string } } | null;
        if (result?.session?.access_token && result?.session?.refresh_token) {
          await supabaseStorefront.auth.setSession({
            access_token: result.session.access_token,
            refresh_token: result.session.refresh_token,
          });
        }
      } catch (err) {
        console.error("Guest account creation failed:", err);
      }
    })();
    guestAccountPromiseRef.current = p;
    return p;
  };

  const notifyOrderEmail = (ordId: string) => {
    void supabase.functions
      .invoke("notify-order", {
        body: { order_id: ordId, customer_email: email.trim() },
      })
      .then(({ error }) => {
        if (error) console.error("notify-order error:", error.message);
      })
      .catch((err) => console.error("notify-order invoke error:", err));
  };

  const onOrderSuccess = (ordId: string) => {
    if (finalizedOrderIdsRef.current.has(ordId)) return;
    finalizedOrderIdsRef.current.add(ordId);

    // Clean up pending-coupon storage + BuyNow phone (matches old checkout).
    try { sessionStorage.removeItem("pending_coupon"); localStorage.removeItem("pending_coupon"); } catch { /* noop */ }
    try { localStorage.removeItem("checkout_phone"); } catch { /* noop */ }
    try { sessionStorage.removeItem(`ac_${store.id}`); } catch { /* noop */ }

    clearCart();
    window.dispatchEvent(new CustomEvent("order-placed"));

    // Pixel Purchase — dedup with sessionStorage per order (matches old code).
    // Server CAPI is fired by place-order / cashfree-webhook / payu-webhook /
    // razorpay-verify — same event_id so Meta dedupes Pixel ↔ CAPI.
    const purchaseDedupKey = `meta_purchase_fired_${ordId}`;
    let alreadyFired = false;
    try { alreadyFired = sessionStorage.getItem(purchaseDedupKey) === "1"; } catch { /* noop */ }
    if (!alreadyFired) {
      try { sessionStorage.setItem(purchaseDedupKey, "1"); } catch { /* noop */ }
      try {
        fbPixelTrack(
          "Purchase",
          {
            content_ids: cartItems.map((i) => i.productId),
            contents: cartItems.map((i) => ({ id: i.productId, quantity: i.quantity, item_price: i.price })),
            content_type: "product",
            content_name: cartItems.map((i) => i.name).join(", "),
            value: chargeAmount,
            currency,
            num_items: cartItems.reduce((s, i) => s + (i.quantity || 1), 0),
          },
          purchaseEventIdRef.current,
        );
      } catch { /* noop */ }
    }

    // GA4 purchase.
    try {
      ga4Track("purchase", {
        transaction_id: ordId,
        value: chargeAmount,
        currency,
        items: cartItems.map((i) => ({
          item_id: i.productId,
          item_name: i.name,
          item_variant: i.variantId,
          price: i.price,
          quantity: i.quantity,
        })),
      });
    } catch { /* noop */ }

    // Storefront funnel purchase event.
    try {
      fireStorefrontEvent({
        storeId: store.id,
        eventName: "purchase",
        value: chargeAmount,
        currency,
        metadata: { order_id: ordId, items: cartItems.length },
      });
    } catch { /* noop */ }

    // Auto-login for guests, save address for logged-in customers.
    if (!customer) { void createGuestAccount(ordId); } else { void saveAddressToAccount(); }
    notifyOrderEmail(ordId);
  };

  // ─── Payment polling ────────────────────────────────────────────────────
  const [waiting, setWaiting] = useState(false);
  const [waitingApp, setWaitingApp] = useState<string>("");
  const [manualChecking, setManualChecking] = useState(false);

  // Mobile UPI / PayU return flows can reopen checkout in a fresh tab. Keep
  // enough state in localStorage too, not only sessionStorage.
  const WAIT_KEY = `sf_wait_v2_${store.id}`;
  const persistWaiting = (app: UpiApp, label: string, override?: { orderId?: string | null; orderNumber?: string | null }) => {
    try {
      const payload = JSON.stringify({
        orderId: override?.orderId ?? orderId,
        orderNumber: override?.orderNumber ?? orderNumber,
        app,
        label,
        gateway: gatewayRef.current,
        ts: Date.now(),
      });
      sessionStorage.setItem(WAIT_KEY, payload);
      localStorage.setItem(WAIT_KEY, payload);
    } catch { /* noop */ }
  };
  const clearWaiting = () => {
    try { sessionStorage.removeItem(WAIT_KEY); } catch { /* noop */ }
    try { localStorage.removeItem(WAIT_KEY); } catch { /* noop */ }
  };

  const normalizeGatewayResult = (payload: any): "success" | "pending" => {
    const raw = String(payload?.status || payload?.payment_status || payload?.order_status || "").toLowerCase();
    if (payload?.success === true || ["paid", "success", "captured", "authorized"].includes(raw)) return "success";
    return "pending";
  };

  const forceGatewayVerify = async () => {
    if (!orderId) return null;
    const gw = gatewayRef.current;
    try {
      if (gw.pg === "cashfree" && gw.cf_order_id) {
        const { data } = await supabase.functions.invoke("store-cashfree-status", {
          body: { store_id: store.id, order_id: orderId, cf_order_id: gw.cf_order_id },
        });
        return data;
      }
      if (gw.pg === "razorpay") {
        const { data } = await supabase.functions.invoke("razorpay-payment-status", {
          body: { store_id: store.id, order_id: orderId, razorpay_payment_id: gw.razorpay_payment_id },
        });
        return data;
      }
      if (gw.pg === "payu") {
        const { data } = await supabase.functions.invoke("payu-status", {
          body: { store_id: store.id, order_id: orderId, txnid: gw.payu_txnid },
        });
        return data;
      }
    } catch { /* ignore */ }
    return null;
  };

  const [orderPlaced, setOrderPlaced] = useState(false);
  const [viewingOrders, setViewingOrders] = useState(false);
  const finishSuccess = (paidOrderId?: string | null) => {
    const finalOrderId = paidOrderId || orderId;
    if (!finalOrderId) return;
    clearWaiting();
    onOrderSuccess(finalOrderId);
    if (!orderId) setOrderId(finalOrderId);
    setWaiting(false);
    setOrderPlaced(true);
  };

  const handleViewMyOrders = async () => {
    if (viewingOrders) return;
    setViewingOrders(true);
    const orderPath = orderId
      ? storefrontPath(store.slug, `account/orders/${orderId}`)
      : storefrontPath(store.slug, "account");
    try {
      const { data: existing } = await supabaseStorefront.auth.getSession();
      if (existing?.session?.user) { navigate(orderPath); return; }

      if (guestAccountPromiseRef.current) {
        await Promise.race([
          guestAccountPromiseRef.current.catch(() => {}),
          new Promise((r) => setTimeout(r, 600)),
        ]);
        const { data: after } = await supabaseStorefront.auth.getSession();
        if (after?.session?.user) { navigate(orderPath); return; }
      }

      const normalized = normalizePhone(phone);
      if (!normalized || normalized.length < 10) {
        // No phone available (e.g. returning from PayU redirect on fresh tab) —
        // go to the order page anyway; it will render skeleton until auth hydrates.
        navigate(orderPath);
        return;
      }

      navigate(orderPath);
      void (async () => {
        try {
          const { data, error } = await supabase.functions.invoke("phone-login", {
            body: {
              phone: normalized,
              store_id: store.id,
              name: fullName || null,
              claim_order_id: orderId || undefined,
            },
          });
          if (error) throw error;
          const res = data as { session?: { access_token?: string; refresh_token?: string } } | null;
          if (res?.session?.access_token && res?.session?.refresh_token) {
            await supabaseStorefront.auth.setSession({
              access_token: res.session.access_token,
              refresh_token: res.session.refresh_token,
            });
          }
        } catch (err) {
          console.error("phone-login (view orders) failed:", err);
        }
      })();
    } catch (err: any) {
      toast.error(err?.message || "Could not open your orders. Please try again.");
    } finally {
      setViewingOrders(false);
    }
  };

  useEffect(() => {
    if (!waiting || !orderId) return;
    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 120; // 4 min at ~2s
    const checkNow = async (): Promise<boolean> => {
      const gatewayResult = await forceGatewayVerify();
      if (normalizeGatewayResult(gatewayResult) === "success") { finishSuccess(); return true; }
      try {
        const { data } = await supabase.functions.invoke("order-payment-status", {
          body: { store_id: store.id, order_id: orderId },
        });
        const status = (data as any)?.payment_status;
        if (status === "success") { finishSuccess(); return true; }
        if (status === "failed") {
          toast.error("Payment failed — please try again");
          clearWaiting(); setWaiting(false);
          return true;
        }
      } catch { /* keep polling */ }
      return false;
    };
    const poll = async () => {
      if (cancelled) return;
      attempts++;
      const done = await checkNow();
      if (done || cancelled) return;
      if (attempts >= maxAttempts) {
        toast("Still waiting? Tap 'I've paid' to re-check", { duration: 6000 });
        return;
      }
      const delay = attempts < 5 ? 1500 : 2500;
      setTimeout(poll, delay);
    };
    setTimeout(poll, 800);
    const onFocus = () => { checkNow(); };
    const onVis = () => { if (document.visibilityState === "visible") checkNow(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [waiting, orderId]); // eslint-disable-line react-hooks/exhaustive-deps

  const manualRecheck = async () => {
    if (manualChecking || !orderId) return;
    setManualChecking(true);
    try {
      const gatewayResult = await forceGatewayVerify();
      if (normalizeGatewayResult(gatewayResult) === "success") { finishSuccess(); return; }
      const { data } = await supabase.functions.invoke("order-payment-status", {
        body: { store_id: store.id, order_id: orderId },
      });
      const status = (data as any)?.payment_status;
      if (status === "success") { finishSuccess(); return; }
      if (status === "failed") { toast.error("Payment failed — please try again"); clearWaiting(); setWaiting(false); return; }
      toast("Not confirmed yet — please complete the payment in your UPI app");
    } finally {
      setManualChecking(false);
    }
  };

  const tapUpiApp = (app: UpiApp) => {
    const s = intents[app];
    if (s.status !== "ready" || !s.url) return;
    const label = UPI_APPS.find((u) => u.key === app)?.label || "UPI";
    setWaitingApp(label);
    setWaiting(true);
    persistWaiting(app, label);
    try { window.dispatchEvent(new Event("payment-in-progress")); } catch { /* noop */ }
    // MUST be synchronous in same tap event for iOS Safari
    window.location.href = s.url;
  };

  // On mount: restore waiting state if user is returning from a UPI app after
  // the tab was killed. Only restore if less than 15 min old.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(WAIT_KEY) || localStorage.getItem(WAIT_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (!saved?.orderId) return;
      if (Date.now() - (saved.ts || 0) > 15 * 60 * 1000) { clearWaiting(); return; }
      setOrderId(saved.orderId);
      setOrderNumber(saved.orderNumber || null);
      setShowPayment(true);
      setWaitingApp(saved.label || "UPI");
      gatewayRef.current = saved.gateway || {};
      setWaiting(true);
    } catch { /* noop */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // PayU redirect-back recovery. Without this, PayU may return to checkout with
  // success params while the V2 poller has no restored order/gateway state.
  useEffect(() => {
    if (!store?.id) return;
    const params = new URLSearchParams(window.location.search);
    const payuStatus = params.get("payu_status");
    const txnid = params.get("txnid");
    const returnedOrderId = params.get("payu_order");
    if (!payuStatus || !txnid || !returnedOrderId) return;

    gatewayRef.current = { pg: "payu", payu_txnid: txnid };
    setOrderId(returnedOrderId);
    setOrderNumber(null);
    setShowPayment(true);
    setWaitingApp("UPI");
    persistWaiting("any", "UPI", { orderId: returnedOrderId, orderNumber: null });
    setWaiting(true);

    try {
      const u = new URL(window.location.href);
      u.searchParams.delete("payu_status");
      u.searchParams.delete("txnid");
      u.searchParams.delete("payu_order");
      window.history.replaceState({}, "", u.toString());
    } catch { /* noop */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store?.id]);

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
      onOrderSuccess(orderId);
      setOrderPlaced(true);
    } catch (e: any) {
      toast.error(e.message || "Failed to place COD order");
    } finally {
      setPlacingCod(false);
    }
  };

  const forceRecheck = () => { manualRecheck(); };

  // ─── Thank-you screen (matches legacy CheckoutPage post-order UX) ─────
  if (orderPlaced) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <CheckCircle2 className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Order Placed!</h1>
        <p className="mt-2 text-muted-foreground">
          Your order has been placed successfully. The store will contact you shortly.
        </p>
        {(orderNumber || orderId) && (
          <p className="mt-2 text-xs text-muted-foreground">
            Order ID: <span className="font-mono font-semibold">{orderNumber || orderId?.slice(0, 8)}</span>
          </p>
        )}
        <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-3">
          <p className="flex items-center justify-center gap-1.5 text-sm font-medium text-foreground">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" /> Order confirmed!
          </p>
          {(phone || email) && (
            <p className="mt-1 text-xs text-muted-foreground">
              We'll send updates to <strong>{phone}</strong>{email ? ` and ${email}` : ""}.
            </p>
          )}
        </div>
        <div className="mt-6 flex flex-col items-center gap-2">
          <Button
            variant="outline"
            onClick={handleViewMyOrders}
            disabled={viewingOrders}
            className="h-10 px-6"
          >
            {viewingOrders && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            View My Orders
          </Button>
          <Button
            onClick={() => navigate(storefrontPath(store.slug))}
            className="h-10 px-6"
          >
            Continue Shopping
          </Button>
        </div>
      </div>
    );
  }

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
        <Button variant="outline" className="w-full" onClick={forceRecheck} disabled={manualChecking}>
          {manualChecking ? "Checking…" : "I've paid — check now"}
        </Button>

        <button
          className="mt-3 text-xs text-muted-foreground underline"
          onClick={() => { clearWaiting(); setWaiting(false); }}
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
              <div className="border-t pt-2 mt-2 space-y-1">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span>{formatPrice(subtotal, currency)}</span>
                </div>
                {shippingActive && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Shipping</span>
                    <span>{shippingCharge > 0 ? formatPrice(shippingCharge, currency) : "Free"}</span>
                  </div>
                )}
                {taxActive && !taxInclusive && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>{taxName} ({taxRate}%)</span>
                    <span>{formatPrice(taxAmount, currency)}</span>
                  </div>
                )}
                {taxActive && taxInclusive && (
                  <div className="flex justify-between text-muted-foreground text-[10px]">
                    <span>(Inclusive of {taxName})</span>
                    <span>{formatPrice(taxAmount, currency)}</span>
                  </div>
                )}
                {appliedCoupon && couponDiscount > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Coupon ({appliedCoupon.code})</span>
                    <span>− {formatPrice(couponDiscount, currency)}</span>
                  </div>
                )}
              </div>
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
                <div className="text-xs text-muted-foreground mt-2">Amount: {formatPrice(chargeAmount, currency)}</div>
                {intents.any.status === "ready" && (
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => setWaiting(true)}>
                    I've scanned — waiting for payment
                  </Button>
                )}
              </div>
            )}

            {effectiveMode === "full" && (
              <>
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
              </>
            )}

            <div className="text-[10px] text-muted-foreground text-center mt-6 flex items-center justify-center gap-1">
              <ShieldCheck className="h-3 w-3" /> Payments secured by your bank & UPI
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
