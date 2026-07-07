// CheckoutV2 — GoKwik-style 1-page checkout with full feature parity to the
// legacy CheckoutPage. Supports UPI intent deep-links, Razorpay modal,
// Cashfree drop-in, PayU Bolt, and COD — driven by `get_store_payment_config`.
//
// Also ships the full legacy plumbing: address book, coupons, buy-now
// (?product=&variant=), variantId in items, InitiateCheckout + AddPaymentInfo
// Pixel/CAPI events, setCapiUser Advanced Matching, ensureCustomer,
// begin_checkout / pay_click / payment_failed funnel events, PostPurchaseUpsell,
// partial-payment thank-you breakdown, WA consent, returning-guest 1-tap,
// zippopotam pincode fallback + geolocation, Hindi bilingual labels, and
// checkout_token idempotency + payment-failed retry banner + confirmingPayment overlay.

import { useState, useEffect, useMemo, useRef, lazy, Suspense } from "react";
import { useOutletContext, useSearchParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, MapPin, ShieldCheck, CheckCircle2, ArrowLeft, Lock, Banknote, LocateFixed, Tag, X, Plus, Check, CreditCard } from "lucide-react";
import { toast } from "sonner";
import type { StoreData } from "@/layouts/StorefrontLayout";
import { fbPixelTrack, generateEventId } from "@/hooks/useFacebookPixel";
import { ga4Track } from "@/hooks/useGA4";
import { fireMetaCAPI, getMetaCookies } from "@/lib/metaCapi";
import { setCapiUser } from "@/lib/metaEnrichment";
import { getVisitorId, getOrCreateSessionId } from "@/lib/visitorSession";
import { fireStorefrontEvent } from "@/lib/storefrontEvents";
import { loadCashfree } from "@/lib/loadCashfree";
import { loadPayuBolt } from "@/lib/loadPayuBolt";

const PostPurchaseUpsell = lazy(() => import("@/components/storefront/PostPurchaseUpsell"));
const CheckoutPhoneStep = lazy(() => import("@/components/storefront/CheckoutPhoneStep"));

type UpiApp = "gpay" | "phonepe" | "paytm" | "any";
type PayMethod = "upi" | "gateway" | "cod";

interface IntentState {
  status: "idle" | "loading" | "ready" | "failed";
  url?: string;
  error?: string;
}

interface PendingOrder {
  id: string;
  number: string | null;
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

/** Rewrite `upi://pay?...` to app-specific deeplink so target app opens directly. */
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

declare global {
  interface Window {
    Razorpay: any;
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

const SUPABASE_FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

async function callEdgeFunction(fnName: string, body: Record<string, any>) {
  const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/${fnName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || `Edge function ${fnName} failed`);
  return data;
}

function prewarmEdgeFunction(fnName: string) {
  try {
    fetch(`${SUPABASE_FUNCTIONS_URL}/${fnName}`, {
      method: "OPTIONS",
      headers: {
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type, authorization",
      },
    }).catch(() => {});
  } catch { /* noop */ }
}

export default function CheckoutV2Page() {
  const store = useOutletContext<StoreData>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const qc = useQueryClient();
  const { items: cartItems, clearCart } = useCart();
  const { customer, ensureCustomer } = useStorefrontAuth();
  const currency = store?.currency || "INR";
  const isHindi = store?.theme === "theme-16" || store?.theme === "theme-21";
  const tCritical = (en: string, hi: string) => (isHindi ? `${en} / ${hi}` : en);

  // ─── Buy-now (?product=&variant=) single-product mode ──────────────────
  const productId = searchParams.get("product");
  const variantId = searchParams.get("variant");
  const isSingleMode = !!productId;

  const { data: buyNowProduct, isLoading: buyNowProductLoading } = useQuery({
    queryKey: ["checkoutv2-product", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("id", productId!)
        .eq("is_active", true)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!productId,
    staleTime: 10 * 60 * 1000,
    initialData: () => {
      if (!productId) return undefined;
      const matches = qc.getQueriesData<any>({ queryKey: ["storefront-product", store?.id] });
      for (const [, p] of matches) if (p && p.id === productId) return p;
      return undefined;
    },
  });

  const { data: buyNowVariant } = useQuery({
    queryKey: ["checkoutv2-variant", variantId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("product_variants")
        .select("*")
        .eq("id", variantId!)
        .eq("is_active", true)
        .single();
      if (error) throw error;
      return data as { id: string; name: string; price: number | null };
    },
    enabled: !!variantId,
    staleTime: 10 * 60 * 1000,
  });

  // Unified checkout items (buy-now OR cart). Includes variantId + image.
  const checkoutItems = useMemo(() => {
    if (isSingleMode && buyNowProduct) {
      return [{
        productId: buyNowProduct.id as string,
        variantId: (buyNowVariant?.id as string | undefined),
        name: buyNowVariant ? `${buyNowProduct.name} (${buyNowVariant.name})` : buyNowProduct.name,
        price: (buyNowVariant?.price ?? (buyNowProduct.sale_price && buyNowProduct.sale_price < buyNowProduct.price ? buyNowProduct.sale_price : buyNowProduct.price)) as number,
        quantity: 1,
        image: buyNowProduct.image_url as string | null,
      }];
    }
    return cartItems.map((i) => ({
      productId: i.productId,
      variantId: i.variantId,
      name: i.variantName ? `${i.name} (${i.variantName})` : i.name,
      price: i.price,
      quantity: i.quantity,
      image: (i as any).image || null,
    }));
  }, [isSingleMode, buyNowProduct, buyNowVariant, cartItems]);

  // ─── Form state (with express_checkout_ prefill) ────────────────────────
  const savedInfo = (() => {
    try { return JSON.parse(localStorage.getItem(`express_checkout_${store?.id}`) || "{}"); } catch { return {}; }
  })();
  const buyNowPhone = (() => { try { return localStorage.getItem("checkout_phone") || ""; } catch { return ""; } })();

  const [phone, setPhone] = useState<string>(() => {
    const s = buyNowPhone || savedInfo.phone || "";
    const n = normalizePhone(s);
    return isValidIndianPhone(n) ? n : (s || "");
  });
  const [fullName, setFullName] = useState(savedInfo.fullName || "");
  const [email, setEmail] = useState("");
  const [pincode, setPincode] = useState(savedInfo.pincode || "");
  const [streetAddress, setStreetAddress] = useState(savedInfo.streetAddress || "");
  const [city, setCity] = useState(savedInfo.city || "");
  const [state, setState] = useState(savedInfo.state || "");
  const [waConsent, setWaConsent] = useState<boolean>(savedInfo.waConsent !== false);

  // ─── Lazy customer create + email auto-fill ─────────────────────────────
  useEffect(() => { ensureCustomer?.(); }, [ensureCustomer]);
  useEffect(() => {
    if (customer?.email && !email) setEmail(customer.email);
  }, [customer]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Meta Advanced Matching (setCapiUser debounced on field change) ─────
  useEffect(() => {
    const t = setTimeout(() => {
      const parts = (fullName || "").trim().split(/\s+/).filter(Boolean);
      const firstName = parts[0];
      const lastName = parts.length > 1 ? parts.slice(1).join(" ") : undefined;
      const hasAny = !!(email || phone || fullName || city || state || pincode);
      if (!hasAny) return;
      try {
        setCapiUser({
          email: email.trim() || undefined,
          phone: normalizePhone(phone) || undefined,
          externalId: customer?.id || undefined,
          firstName,
          lastName,
          city: city.trim() || undefined,
          state: state.trim() || undefined,
          zipCode: pincode.trim() || undefined,
        });
      } catch { /* noop */ }
    }, 400);
    return () => clearTimeout(t);
  }, [email, phone, fullName, city, state, pincode, customer?.id]);

  // ─── Pincode auto-fill (postalpincode.in with zippopotam.us fallback) ───
  const [pincodeLoading, setPincodeLoading] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  useEffect(() => {
    if (!/^\d{6}$/.test(pincode)) return;
    let cancelled = false;
    setPincodeLoading(true);
    (async () => {
      const tryPrimary = async () => {
        const r = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
        const j = await r.json();
        const po = j?.[0]?.PostOffice?.[0];
        if (!po) throw new Error("no post office");
        return { city: po.District as string, state: po.State as string };
      };
      const tryFallback = async () => {
        const r = await fetch(`https://api.zippopotam.us/in/${pincode}`);
        const j = await r.json();
        const p = j?.places?.[0];
        if (!p) throw new Error("no place");
        return { city: p["place name"] as string, state: p["state"] as string };
      };
      try {
        let result: { city: string; state: string } | null = null;
        try { result = await tryPrimary(); } catch { /* try fallback */ }
        if (!result) { try { result = await tryFallback(); } catch { /* silent */ } }
        if (cancelled || !result) return;
        if (!city) setCity(result.city || "");
        if (!state) setState(result.state || "");
      } finally { if (!cancelled) setPincodeLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [pincode]); // eslint-disable-line react-hooks/exhaustive-deps

  const detectLocation = () => {
    if (!navigator?.geolocation) { toast.error("Geolocation not supported on this browser"); return; }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const { data, error } = await supabase.functions.invoke("reverse-geocode", {
          body: { lat: pos.coords.latitude, lng: pos.coords.longitude },
        });
        if (error) throw error;
        const addr = (data as any)?.address ?? {};
        let filled = 0;
        if (addr.pincode) { setPincode(addr.pincode); filled++; }
        if (addr.city) { setCity(addr.city); filled++; }
        if (addr.state) { setState(addr.state); filled++; }
        if (addr.street_address) { setStreetAddress(addr.street_address); filled++; }
        if (filled === 0) toast.error("Could not read address from your location");
        else toast.success("Location filled");
      } catch (e: any) {
        toast.error(e?.message || "Could not detect location");
      } finally {
        setGeoLoading(false);
      }
    }, (err) => {
      setGeoLoading(false);
      toast.error(err?.code === 1 ? "Please allow location permission" : "Could not get your location");
    }, { timeout: 10000, enableHighAccuracy: true, maximumAge: 60000 });
  };


  // ─── Store config queries ───────────────────────────────────────────────
  const { data: shippingConfig } = useQuery({
    queryKey: ["storefront-shipping-config", store?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("store_shipping_config").select("*").eq("store_id", store.id).maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 30 * 60 * 1000,
    enabled: !!store?.id,
  });

  const { data: taxConfig } = useQuery({
    queryKey: ["store-tax-config", store?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("store_tax_config").select("*").eq("store_id", store.id).maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 30 * 60 * 1000,
    enabled: !!store?.id,
  });

  const { data: paymentConfig, isFetched: paymentConfigFetched, isError: paymentConfigError } = useQuery({
    queryKey: ["store-payment-config", store?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_store_payment_config", { _store_id: store.id });
      if (error) throw error;
      return data as {
        payment_methods: string[];
        razorpay_key_id: string | null;
        cashfree_app_id: string | null;
        cashfree_env: string | null;
        payu_merchant_key: string | null;
        payu_env: string | null;
      } | null;
    },
    staleTime: 30 * 60 * 1000,
    retry: 2,
    refetchOnWindowFocus: false,
    enabled: !!store?.id,
  });
  const paymentConfigLoaded = paymentConfigFetched && !paymentConfigError;
  const availableMethods = paymentConfig?.payment_methods ?? [];
  const hasCod = availableMethods.includes("cod");
  const hasRazorpay = availableMethods.includes("razorpay");
  const hasCashfree = availableMethods.includes("cashfree");
  const hasPayu = availableMethods.includes("payu");
  const hasOnline = hasRazorpay || hasCashfree || hasPayu;
  const activeGateway: "razorpay" | "cashfree" | "payu" | null =
    hasRazorpay ? "razorpay" : hasCashfree ? "cashfree" : hasPayu ? "payu" : null;

  const { data: hasActiveCoupons } = useQuery({
    queryKey: ["store-has-coupons", store?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("store_has_active_coupons", { _store_id: store.id });
      if (error) throw error;
      return !!data;
    },
    staleTime: 10 * 60 * 1000,
    enabled: !!store?.id,
  });

  // ─── Preload SDKs + prewarm edge functions when payment config resolves ─
  useEffect(() => {
    if (!paymentConfigLoaded) return;
    if (hasRazorpay) { loadRazorpayScript(); prewarmEdgeFunction("razorpay-order"); prewarmEdgeFunction("razorpay-verify"); prewarmEdgeFunction("razorpay-payment-status"); }
    if (hasCashfree) {
      loadCashfree(((paymentConfig?.cashfree_env as any) === "sandbox" ? "sandbox" : "production")).catch(() => {});
      prewarmEdgeFunction("store-cashfree-create-order");
      prewarmEdgeFunction("store-cashfree-verify");
      prewarmEdgeFunction("store-cashfree-status");
    }
    if (hasPayu) {
      if ((paymentConfig?.payu_env as any) === "sandbox") loadPayuBolt("sandbox").catch(() => {});
      else loadPayuBolt("production").catch(() => {});
      prewarmEdgeFunction("payu-create-txn");
      prewarmEdgeFunction("payu-verify-payment");
      prewarmEdgeFunction("payu-status");
    }
    prewarmEdgeFunction("place-order");
    prewarmEdgeFunction("create-upi-intent");
  }, [paymentConfigLoaded, hasRazorpay, hasCashfree, hasPayu, paymentConfig?.cashfree_env, paymentConfig?.payu_env]);

  // ─── Address book (logged-in customers) ─────────────────────────────────
  const { data: savedAddresses } = useQuery({
    queryKey: ["checkoutv2-saved-addresses", customer?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("customer_addresses")
        .select("*")
        .eq("storefront_customer_id", customer!.id)
        .order("is_default", { ascending: false });
      return data || [];
    },
    enabled: !!customer?.id,
  });
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [showAddressDialog, setShowAddressDialog] = useState(false);
  const [showAddAddress, setShowAddAddress] = useState(false);
  const [newAddr, setNewAddr] = useState({ label: "Home", full_name: "", phone: "", street_address: "", city: "", state: "", pincode: "" });

  const selectAddress = (addr: any) => {
    setSelectedAddressId(addr.id);
    setFullName(addr.full_name || "");
    setPhone(addr.phone || "");
    setStreetAddress(addr.street_address || "");
    setCity(addr.city || "");
    setState(addr.state || "");
    setPincode(addr.pincode || "");
  };
  useEffect(() => {
    if (savedAddresses && savedAddresses.length > 0 && !selectedAddressId) {
      const def = savedAddresses.find((a: any) => a.is_default) || savedAddresses[0];
      if (def) selectAddress(def);
    }
  }, [savedAddresses]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveNewAddress = async () => {
    if (!customer?.id) return;
    if (!newAddr.full_name.trim() || !newAddr.street_address.trim() || !/^\d{6}$/.test(newAddr.pincode)) {
      toast.error("Fill all required fields");
      return;
    }
    try {
      const { count } = await supabaseStorefront
        .from("customer_addresses")
        .select("id", { count: "exact", head: true })
        .eq("storefront_customer_id", customer.id);
      const { data, error } = await supabaseStorefront.from("customer_addresses").insert({
        storefront_customer_id: customer.id,
        label: newAddr.label || "Home",
        full_name: newAddr.full_name.trim(),
        phone: normalizePhone(newAddr.phone),
        street_address: newAddr.street_address.trim(),
        city: newAddr.city.trim(),
        state: newAddr.state.trim(),
        pincode: newAddr.pincode.trim(),
        is_default: (count ?? 0) === 0,
      }).select().single();
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["checkoutv2-saved-addresses", customer.id] });
      if (data) selectAddress(data);
      setShowAddAddress(false);
      setShowAddressDialog(false);
      setNewAddr({ label: "Home", full_name: "", phone: "", street_address: "", city: "", state: "", pincode: "" });
    } catch (e: any) {
      toast.error(e?.message || "Failed to save address");
    }
  };

  // ─── Returning-guest 1-tap pre-fill ─────────────────────────────────────
  const [returningOrder, setReturningOrder] = useState<any | null>(null);
  const [returningDismissed, setReturningDismissed] = useState(false);
  const [returningUsed, setReturningUsed] = useState(false);
  const lastLookedUpPhoneRef = useRef<string>("");
  useEffect(() => {
    if (savedAddresses && savedAddresses.length > 0) return;
    if (returningDismissed || returningUsed) return;
    const norm = normalizePhone(phone);
    if (!isValidIndianPhone(norm)) { setReturningOrder(null); return; }
    if (norm === lastLookedUpPhoneRef.current) return;
    lastLookedUpPhoneRef.current = norm;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from("orders")
          .select("id, customer_name, customer_phone, street_address, city, state, pincode, created_at")
          .eq("store_id", store.id)
          .eq("customer_phone", norm)
          .not("street_address", "is", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (cancelled) return;
        if (data && data.street_address && data.pincode) setReturningOrder(data);
        else setReturningOrder(null);
      } catch { if (!cancelled) setReturningOrder(null); }
    })();
    return () => { cancelled = true; };
  }, [phone, store?.id, savedAddresses, returningDismissed, returningUsed]);

  const applyReturningOrder = () => {
    if (!returningOrder) return;
    setFullName(returningOrder.customer_name || "");
    setStreetAddress(returningOrder.street_address || "");
    setCity(returningOrder.city || "");
    setState(returningOrder.state || "");
    setPincode(returningOrder.pincode || "");
    setReturningUsed(true);
    toast.success("Welcome back! Address loaded ✨");
  };

  // ─── Totals ─────────────────────────────────────────────────────────────
  const subtotal = useMemo(
    () => checkoutItems.reduce((s, i) => s + i.price * i.quantity, 0),
    [checkoutItems],
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

  // ─── Coupon (manual + auto-apply) ───────────────────────────────────────
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponOpen, setCouponOpen] = useState(false);
  const autoAppliedCouponRef = useRef(false);
  const urlCoupon =
    searchParams.get("coupon") ||
    (typeof window !== "undefined"
      ? sessionStorage.getItem("pending_coupon") || localStorage.getItem("pending_coupon")
      : null);

  const applyCoupon = async (overrideCode?: string) => {
    const code = (overrideCode ?? couponCode).trim().toUpperCase();
    if (!code) return;
    setCouponLoading(true);
    try {
      const { data: rows, error } = await (supabase as any).rpc("validate_store_coupon", {
        _store_id: store.id, _code: code,
      });
      const data: any = Array.isArray(rows) ? rows[0] ?? null : rows ?? null;
      if (error) throw error;
      if (!data) { autoAppliedCouponRef.current = false; toast.error("Invalid coupon code"); return; }
      const now = new Date();
      if (data.starts_at && new Date(data.starts_at) > now) { toast.error("Coupon not yet active"); return; }
      if (data.expires_at && new Date(data.expires_at) < now) { toast.error("Coupon has expired"); return; }
      if (data.max_uses && data.used_count >= data.max_uses) { toast.error("Coupon usage limit reached"); return; }
      if (subtotal < (data.min_order_amount || 0)) { toast.error(`Minimum order amount is ${formatPrice(data.min_order_amount, currency)}`); return; }
      let discount = data.discount_type === "percentage" ? (subtotal * data.discount_value) / 100 : data.discount_value;
      discount = Math.min(discount, subtotal);
      setAppliedCoupon(data);
      setCouponDiscount(discount);
      setCouponCode(code);
      toast.success(`Coupon applied — you save ${formatPrice(discount, currency)}`);
    } catch { toast.error("Failed to validate coupon"); }
    finally { setCouponLoading(false); }
  };
  const removeCoupon = () => { setAppliedCoupon(null); setCouponDiscount(0); setCouponCode(""); autoAppliedCouponRef.current = false; };

  useEffect(() => {
    if (!urlCoupon || autoAppliedCouponRef.current) return;
    if (!store?.id || subtotal <= 0 || appliedCoupon) return;
    autoAppliedCouponRef.current = true;
    applyCoupon(urlCoupon.toUpperCase());
  }, [urlCoupon, store?.id, subtotal, appliedCoupon]); // eslint-disable-line react-hooks/exhaustive-deps

  const total = Math.max(0, subtotal + (taxInclusive ? 0 : taxAmount) + shippingCharge - couponDiscount);

  // ─── Partial payment ────────────────────────────────────────────────────
  const partialEnabled: boolean = (store as any)?.partial_payment_enabled ?? false;
  const partialType: string = (store as any)?.partial_payment_type || "percentage";
  const partialValue: number | null = (store as any)?.partial_payment_value ?? null;
  const hasPartial = partialEnabled && !!partialValue && Number(partialValue) > 0 && hasOnline;

  const partialAdvanceTotal = useMemo(() => {
    if (!hasPartial) return total;
    let advance = 0;
    for (const it of checkoutItems) {
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
  }, [checkoutItems, hasPartial, partialType, partialValue, subtotal, taxAmount, taxInclusive, shippingCharge, couponDiscount, total]);
  const partialBalanceDue = Math.max(0, total - partialAdvanceTotal);

  const [payMode, setPayMode] = useState<"full" | "partial">("partial");
  const isPartialOrder = hasPartial && payMode === "partial";
  const effectiveMode: "full" | "partial" = isPartialOrder ? "partial" : "full";
  const chargeAmount = isPartialOrder ? partialAdvanceTotal : total;

  // ─── Abandoned cart (respects waConsent) ────────────────────────────────
  // NOTE: on first render `store?.id` is often undefined, so we intentionally
  // start `null` and hydrate from sessionStorage inside the effect below once
  // the store is known. CheckoutPhoneStep (Step 1) already writes
  // `sessionStorage[ac_${storeId}]` on submit, so we MUST re-read it here to
  // avoid a duplicate `capture_checkout_lead` call after the phone gate.
  const [abandonedCartId, setAbandonedCartId] = useState<string | null>(null);
  useEffect(() => {
    if (!store?.id) return;
    if (abandonedCartId) return;
    // Hydrate from Step 1's write first — prevents double capture.
    try {
      const cached = sessionStorage.getItem(`ac_${store.id}`);
      if (cached) { setAbandonedCartId(cached); return; }
    } catch { /* noop */ }
    if (checkoutItems.length === 0) return;
    const canonPhone = normalizePhone(phone);
    if (!canonPhone) return;
    (async () => {
      try {
        let sessionToken: string | null = null;
        try { sessionToken = getOrCreateSessionId(); } catch { /* noop */ }
        const { data } = await (supabase as any).rpc("capture_checkout_lead", {
          p_store_id: store.id,
          p_phone: canonPhone,
          p_cart_items: checkoutItems.map((i) => ({ name: i.name, price: i.price, quantity: i.quantity, productId: i.productId, variantId: i.variantId, image: (i as any).image })),
          p_consent: waConsent,
          p_session_token: sessionToken,
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
  }, [store?.id, phone, checkoutItems.length, waConsent]);

  // ─── begin_checkout storefront funnel event (once per mount) ────────────
  useEffect(() => {
    if (!store?.id) return;
    try { fireStorefrontEvent({ storeId: store.id, eventName: "begin_checkout" }); } catch { /* noop */ }
  }, [store?.id]);

  // ─── Order + payment state ──────────────────────────────────────────────
  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const [pendingOrder, setPendingOrder] = useState<PendingOrder | null>(null);
  const [paymentFailed, setPaymentFailed] = useState(false);
  const [checkoutToken] = useState<string>(() => (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : `ct_${Date.now()}_${Math.random().toString(36).slice(2)}`);

  const [intents, setIntents] = useState<Record<UpiApp, IntentState>>({
    gpay: { status: "idle" }, phonepe: { status: "idle" },
    paytm: { status: "idle" }, any: { status: "idle" },
  });
  const gatewayRef = useRef<{
    pg?: "cashfree" | "razorpay" | "payu";
    cf_order_id?: string;
    payu_txnid?: string;
    razorpay_payment_id?: string;
  }>({});
  const purchaseEventIdRef = useRef<string>(generateEventId());
  const metaCookiesRef = useRef<{ fbc: string; fbp: string }>(getMetaCookies());

  // ─── InitiateCheckout / AddPaymentInfo (fire at real intent only) ───────
  const initiateCheckoutFiredRef = useRef(false);
  const fireInitiateCheckoutOnce = () => {
    if (initiateCheckoutFiredRef.current) return;
    if (!store?.id || checkoutItems.length === 0) return;
    initiateCheckoutFiredRef.current = true;
    const eid = generateEventId();
    const eventData = {
      content_ids: checkoutItems.map((i) => i.productId),
      contents: checkoutItems.map((i) => ({ id: i.productId, quantity: i.quantity, item_price: i.price })),
      num_items: checkoutItems.reduce((s, i) => s + (i.quantity || 1), 0),
      value: subtotal,
      currency,
    };
    try { fbPixelTrack("InitiateCheckout", eventData, eid); } catch { /* noop */ }
    try {
      fireMetaCAPI({
        storeId: store.id,
        eventName: "InitiateCheckout",
        eventId: eid,
        userEmail: email.trim() || undefined,
        userPhone: normalizePhone(phone) || undefined,
        externalId: customer?.id || undefined,
        customData: { ...eventData },
      });
    } catch { /* noop */ }
    try {
      ga4Track("begin_checkout", {
        currency, value: subtotal,
        items: checkoutItems.map((i) => ({
          item_id: i.productId, item_name: i.name, item_variant: i.variantId, price: i.price, quantity: i.quantity,
        })),
      });
    } catch { /* noop */ }
  };

  const apiFiredRef = useRef<Set<string>>(new Set());
  const fireAddPaymentInfoOnce = (methodLabel: string, value: number) => {
    if (!store?.id || checkoutItems.length === 0) return;
    if (apiFiredRef.current.has(methodLabel)) return;
    apiFiredRef.current.add(methodLabel);
    const eid = generateEventId();
    const data = {
      payment_method: methodLabel,
      content_ids: checkoutItems.map((i) => i.productId),
      contents: checkoutItems.map((i) => ({ id: i.productId, quantity: i.quantity, item_price: i.price })),
      num_items: checkoutItems.reduce((s, i) => s + (i.quantity || 1), 0),
      value, currency,
    };
    try { fbPixelTrack("AddPaymentInfo", data, eid); } catch { /* noop */ }
    try {
      fireMetaCAPI({
        storeId: store.id, eventName: "AddPaymentInfo", eventId: eid,
        userEmail: email.trim() || undefined,
        userPhone: normalizePhone(phone) || undefined,
        externalId: customer?.id || undefined,
        customData: data,
      });
    } catch { /* noop */ }
  };

  // ─── Validation ─────────────────────────────────────────────────────────
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

  // ─── place-order payload builders ───────────────────────────────────────
  const buildPlaceOrderMeta = () => {
    let safeUrl: string | undefined;
    try {
      const u = new URL(window.location.href);
      const h = u.hostname;
      const isPreview =
        h === "localhost" || h === "127.0.0.1" ||
        h.endsWith(".lovableproject.com") || h.endsWith(".lovable.dev") || h.endsWith(".sandbox.lovable.dev");
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
    } catch { return `${window.location.origin}/checkout`; }
  };

  const saveExpressInfo = () => {
    try {
      localStorage.setItem("checkout_phone", normalizePhone(phone));
      localStorage.setItem(`express_checkout_${store.id}`, JSON.stringify({
        fullName, email, pincode, streetAddress, city, state, phone: normalizePhone(phone), waConsent,
      }));
    } catch { /* noop */ }
  };

  const placeOrderRow = async (paymentMethodHint: string): Promise<PendingOrder> => {
    const orderNotes = appliedCoupon
      ? `Coupon: ${appliedCoupon.code} (-${formatPrice(couponDiscount, currency)})`
      : undefined;
    const { data, error } = await supabase.functions.invoke("place-order", {
      body: {
        store_id: store.id,
        checkout_token: checkoutToken,
        order: {
          total, currency, status: "pending",
          customer_name: fullName.trim(),
          customer_phone: normalizePhone(phone),
          customer_email: email.trim() || null,
          street_address: streetAddress.trim(),
          city: city.trim(), state: state.trim(), pincode: pincode.trim(),
          payment_method: paymentMethodHint,
          notes: orderNotes,
          storefront_customer_id: customer?.id ?? null,
          payment_type: effectiveMode,
        },
        items: checkoutItems.map((it) => ({
          productId: it.productId,
          variantId: it.variantId,
          name: it.name, price: it.price, quantity: it.quantity,
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
    return { id: result.order_id, number: result.order_number || null };
  };

  // ─── Post-order plumbing ────────────────────────────────────────────────
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
        city: city.trim(), state: state.trim(), pincode: pincode.trim(),
        is_default: (count ?? 0) === 0,
      });
    } catch (err) { console.error("Failed to save address to account:", err); }
  };

  const guestAccountPromiseRef = useRef<Promise<void> | null>(null);
  const createGuestAccount = (ordId: string) => {
    const p = (async () => {
      try {
        const { data } = await supabase.functions.invoke("create-guest-account", {
          body: {
            email: email.trim(), phone: normalizePhone(phone),
            name: fullName.trim(), store_id: store.id, order_id: ordId,
          },
        });
        const result = data as { session?: { access_token?: string; refresh_token?: string } } | null;
        if (result?.session?.access_token && result?.session?.refresh_token) {
          await supabaseStorefront.auth.setSession({
            access_token: result.session.access_token,
            refresh_token: result.session.refresh_token,
          });
        }
      } catch (err) { console.error("Guest account creation failed:", err); }
    })();
    guestAccountPromiseRef.current = p;
    return p;
  };

  const notifyOrderEmail = (ordId: string) => {
    void supabase.functions.invoke("notify-order", {
      body: { order_id: ordId, customer_email: email.trim() },
    }).then(({ error }) => { if (error) console.error("notify-order error:", error.message); })
      .catch((err) => console.error("notify-order invoke error:", err));
  };

  const onOrderSuccess = (ordId: string) => {
    if (finalizedOrderIdsRef.current.has(ordId)) return;
    finalizedOrderIdsRef.current.add(ordId);

    try { sessionStorage.removeItem("pending_coupon"); localStorage.removeItem("pending_coupon"); } catch { /* noop */ }
    try { localStorage.removeItem("checkout_phone"); } catch { /* noop */ }
    try { sessionStorage.removeItem(`ac_${store.id}`); } catch { /* noop */ }
    saveExpressInfo();

    if (!isSingleMode) clearCart();
    window.dispatchEvent(new CustomEvent("order-placed"));

    // Pixel Purchase — dedupe per order.
    const purchaseDedupKey = `meta_purchase_fired_${ordId}`;
    let alreadyFired = false;
    try { alreadyFired = sessionStorage.getItem(purchaseDedupKey) === "1"; } catch { /* noop */ }
    if (!alreadyFired) {
      try { sessionStorage.setItem(purchaseDedupKey, "1"); } catch { /* noop */ }
      try {
        fbPixelTrack("Purchase", {
          content_ids: checkoutItems.map((i) => i.productId),
          contents: checkoutItems.map((i) => ({ id: i.productId, quantity: i.quantity, item_price: i.price })),
          content_type: "product",
          content_name: checkoutItems.map((i) => i.name).join(", "),
          value: chargeAmount, currency,
          num_items: checkoutItems.reduce((s, i) => s + (i.quantity || 1), 0),
        }, purchaseEventIdRef.current);
      } catch { /* noop */ }
    }

    try {
      ga4Track("purchase", {
        transaction_id: ordId, value: chargeAmount, currency,
        items: checkoutItems.map((i) => ({
          item_id: i.productId, item_name: i.name, item_variant: i.variantId, price: i.price, quantity: i.quantity,
        })),
      });
    } catch { /* noop */ }

    try {
      fireStorefrontEvent({
        storeId: store.id, eventName: "purchase",
        value: chargeAmount, currency,
        metadata: { order_id: ordId, items: checkoutItems.length },
      });
    } catch { /* noop */ }

    if (isPartialOrder) {
      setAdvancePaid(partialAdvanceTotal);
      setBalanceDue(partialBalanceDue);
    }

    if (!customer) { void createGuestAccount(ordId); } else { void saveAddressToAccount(); }
    notifyOrderEmail(ordId);
  };

  // ─── UPI intent + polling ───────────────────────────────────────────────
  const [waiting, setWaiting] = useState(false);
  const [waitingApp, setWaitingApp] = useState<string>("");
  const [manualChecking, setManualChecking] = useState(false);

  const WAIT_KEY = `sf_wait_v2_${store?.id}`;
  const persistWaiting = (app: UpiApp, label: string, override?: { orderId?: string | null; orderNumber?: string | null }) => {
    try {
      const payload = JSON.stringify({
        orderId: override?.orderId ?? orderId,
        orderNumber: override?.orderNumber ?? orderNumber,
        app, label, gateway: gatewayRef.current, ts: Date.now(),
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
    } catch { /* noop */ }
    return null;
  };

  const [orderPlaced, setOrderPlaced] = useState(false);
  const [viewingOrders, setViewingOrders] = useState(false);
  const [showUpsell, setShowUpsell] = useState(false);
  const [advancePaid, setAdvancePaid] = useState(0);
  const [balanceDue, setBalanceDue] = useState(0);

  const finishSuccess = (paidOrderId?: string | null) => {
    const finalOrderId = paidOrderId || orderId;
    if (!finalOrderId) return;
    clearWaiting();
    onOrderSuccess(finalOrderId);
    if (!orderId) setOrderId(finalOrderId);
    setWaiting(false);
    setConfirmingPayment(false);
    setPaymentFailed(false);
    setPendingOrder(null);
    setOrderPlaced(true);
    setShowUpsell(true);
    try { window.scrollTo({ top: 0, behavior: "auto" }); } catch { /* noop */ }
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
      if (!normalized || normalized.length < 10) { navigate(orderPath); return; }
      navigate(orderPath);
      void (async () => {
        try {
          const { data, error } = await supabase.functions.invoke("phone-login", {
            body: { phone: normalized, store_id: store.id, name: fullName || null, claim_order_id: orderId || undefined },
          });
          if (error) throw error;
          const res = data as { session?: { access_token?: string; refresh_token?: string } } | null;
          if (res?.session?.access_token && res?.session?.refresh_token) {
            await supabaseStorefront.auth.setSession({
              access_token: res.session.access_token,
              refresh_token: res.session.refresh_token,
            });
          }
        } catch (err) { console.error("phone-login (view orders) failed:", err); }
      })();
    } catch (err: any) {
      toast.error(err?.message || "Could not open your orders. Please try again.");
    } finally {
      setViewingOrders(false);
    }
  };

  // ─── UPI polling ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!waiting || !orderId) return;
    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 120;
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
          try { fireStorefrontEvent({ storeId: store.id, eventName: "payment_failed" as any, metadata: { order_id: orderId } as any }); } catch { /* noop */ }
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
      if (attempts >= maxAttempts) { toast("Still waiting? Tap 'I've paid' to re-check", { duration: 6000 }); return; }
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
    } finally { setManualChecking(false); }
  };

  const tapUpiApp = (app: UpiApp) => {
    const s = intents[app];
    if (s.status !== "ready" || !s.url) return;
    const label = UPI_APPS.find((u) => u.key === app)?.label || "UPI";
    setWaitingApp(label);
    setWaiting(true);
    persistWaiting(app, label);
    try { fireStorefrontEvent({ storeId: store.id, eventName: "pay_click" as any, metadata: { method: `upi_${app}` } as any }); } catch { /* noop */ }
    fireInitiateCheckoutOnce();
    fireAddPaymentInfoOnce(`upi_${app}`, chargeAmount);
    try { window.dispatchEvent(new Event("payment-in-progress")); } catch { /* noop */ }
    window.location.href = s.url;
  };

  // ─── Restore waiting state on mount / PayU redirect-back ────────────────
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

  // ─── Cashfree redirect-back recovery (mirrors CheckoutPage) ─────────────
  useEffect(() => {
    if (!store?.id) return;
    const params = new URLSearchParams(window.location.search);
    const cfOrderQ = params.get("cf_order");
    const orderQ = params.get("order");
    if (!cfOrderQ || !orderQ) return;
    gatewayRef.current = { pg: "cashfree", cf_order_id: cfOrderQ };
    setOrderId(orderQ);
    setOrderNumber(null);
    setShowPayment(true);
    setWaitingApp("Cashfree");
    persistWaiting("any", "Cashfree", { orderId: orderQ, orderNumber: null });
    setWaiting(true);
    try {
      const u = new URL(window.location.href);
      u.searchParams.delete("cf_order");
      u.searchParams.delete("order");
      window.history.replaceState({}, "", u.toString());
    } catch { /* noop */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store?.id]);

  // ─── Create order (single call, dedup with checkout_token) ──────────────
  const createOrderIfNeeded = async (paymentMethodHint: string): Promise<PendingOrder> => {
    if (orderId) return { id: orderId, number: orderNumber };
    const created = await placeOrderRow(paymentMethodHint);
    setOrderId(created.id);
    setOrderNumber(created.number);
    return created;
  };

  // ─── UPI intent-based flow (mobile-first) ───────────────────────────────
  const createOrderAndIntents = async () => {
    const err = validateAddress();
    if (err) {
      toast.error(err);
      try { fireStorefrontEvent({ storeId: store.id, eventName: "checkout_field_error" as any, metadata: { error: err } as any }); } catch { /* noop */ }
      return;
    }
    if (checkoutItems.length === 0) { toast.error("Your cart is empty"); return; }
    if (!paymentConfigLoaded) { toast("Loading payment methods…"); return; }

    setCreatingOrder(true);
    try {
      saveExpressInfo();
      const order = await createOrderIfNeeded("razorpay");
      setShowPayment(true);
      try { fireStorefrontEvent({ storeId: store.id, eventName: "pay_click" as any, metadata: { step: "continue_to_pay" } as any }); } catch { /* noop */ }

      const apps: UpiApp[] = ["gpay", "phonepe", "paytm", "any"];
      setIntents((s) => { const next = { ...s }; apps.forEach((a) => { next[a] = { status: "loading" }; }); return next; });

      try {
        const { data: intentData, error: intErr } = await supabase.functions.invoke("create-upi-intent", {
          body: {
            store_id: store.id, order_id: order.id, app: "any",
            customer_name: fullName.trim(), customer_phone: normalizePhone(phone),
            customer_email: email.trim() || undefined,
            return_url: buildPaymentReturnUrl(),
          },
        });
        const payload: any = intentData ?? (intErr as any)?.context?.body;
        const url: string | undefined = payload?.intent_url;
        if (!url) {
          const errMsg: string = payload?.error || intErr?.message || "Failed";
          setIntents((s) => { const next = { ...s }; apps.forEach((a) => { next[a] = { status: "failed", error: errMsg }; }); return next; });
        } else {
          if (payload?.pg) {
            gatewayRef.current = {
              pg: payload.pg, cf_order_id: payload.cf_order_id,
              payu_txnid: payload.payu_txnid, razorpay_payment_id: payload.razorpay_payment_id,
            };
          }
          setIntents((s) => { const next = { ...s }; apps.forEach((a) => { next[a] = { status: "ready", url: schemeFor(a, url) }; }); return next; });
        }
      } catch (e: any) {
        const msg = e?.message || "Failed";
        setIntents((s) => { const next = { ...s }; apps.forEach((a) => { next[a] = { status: "failed", error: msg }; }); return next; });
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to create order");
    } finally {
      setCreatingOrder(false);
    }
  };

  // ─── Full gateway modal paths (Razorpay / Cashfree / PayU) ──────────────
  const openRazorpay = async (order: PendingOrder) => {
    setConfirmingPayment(false);
    const [loaded, rzpData] = await Promise.all([
      loadRazorpayScript(),
      callEdgeFunction("razorpay-order", {
        store_id: store.id, amount: chargeAmount, currency, order_id: order.id,
      }),
    ]);
    if (!loaded) throw new Error("Failed to load payment gateway");
    gatewayRef.current = { pg: "razorpay" };

    const contactDigits = normalizePhone(phone).replace(/\D/g, "");
    const razorpayContact = contactDigits.length === 12 && contactDigits.startsWith("91") ? contactDigits.slice(2) : contactDigits;

    const handlePaymentSuccess = async (response: any) => {
      setConfirmingPayment(true);
      try {
        try {
          await callEdgeFunction("razorpay-verify", { ...response, order_id: order.id, store_id: store.id });
        } catch (verifyErr) {
          console.warn("Razorpay verify failed, trying status fallback:", verifyErr);
          const statusData = await callEdgeFunction("razorpay-payment-status", {
            razorpay_payment_id: response.razorpay_payment_id, store_id: store.id, order_id: order.id,
          });
          if (statusData.status !== "captured" && statusData.status !== "authorized") throw new Error("Payment verification failed");
        }
        gatewayRef.current.razorpay_payment_id = response.razorpay_payment_id;
        finishSuccess(order.id);
      } catch (err: any) {
        console.error("Payment verification error:", err);
        setConfirmingPayment(false);
        setPendingOrder(order);
        setPaymentFailed(true);
        toast.error(err?.message || "Payment verification failed. You can retry below.");
      }
    };

    const options: any = {
      key: rzpData.key_id,
      amount: rzpData.amount,
      currency: rzpData.currency,
      name: store.name,
      description: isPartialOrder ? `Advance for Order ${order.number || '#' + order.id.slice(0, 8)}` : `Order ${order.number || '#' + order.id.slice(0, 8)}`,
      image: store.logo_url || undefined,
      order_id: rzpData.razorpay_order_id,
      handler: handlePaymentSuccess,
      prefill: { name: fullName.trim(), email: email.trim() || undefined, contact: razorpayContact || undefined },
      readonly: { contact: !!razorpayContact },
      hidden: { contact: !!razorpayContact },
      notes: { order_id: order.id, store_id: store.id },
      theme: { color: "#6366f1" },
      remember_customer: true,
      modal: {
        confirm_close: true,
        ondismiss: async () => {
          try {
            await new Promise(r => setTimeout(r, 2000));
            const statusData = await callEdgeFunction("razorpay-payment-status", {
              razorpay_payment_id: "check_order", store_id: store.id, order_id: order.id,
            });
            if (statusData.status === "captured" || statusData.status === "authorized") {
              finishSuccess(order.id); return;
            }
          } catch { /* noop */ }
          setPendingOrder(order); setPaymentFailed(true);
        },
      },
    };

    const rzp = new window.Razorpay(options);
    rzp.on("payment.failed", (resp: any) => {
      console.error("Razorpay payment failed:", resp?.error);
      setPendingOrder(order); setPaymentFailed(true);
      try { fireStorefrontEvent({ storeId: store.id, eventName: "payment_failed" as any, metadata: { order_id: order.id, gateway: "razorpay" } as any }); } catch { /* noop */ }
      toast.error(resp?.error?.description || "Payment failed. You can retry below.");
    });
    fireInitiateCheckoutOnce();
    fireAddPaymentInfoOnce(isPartialOrder ? "partial_cod_razorpay" : "razorpay", chargeAmount);
    rzp.open();
  };

  const openCashfree = async (order: PendingOrder) => {
    const env = (paymentConfig?.cashfree_env as any) === "sandbox" ? "sandbox" : "production";
    const [cashfree, cfData] = await Promise.all([
      loadCashfree(env),
      callEdgeFunction("store-cashfree-create-order", {
        store_id: store.id, amount: chargeAmount, currency, order_id: order.id,
        customer_name: fullName, customer_phone: phone, customer_email: email || undefined,
        return_url: `${window.location.origin}/checkout?cf_order={order_id}&order=${order.id}`,
      }),
    ]);
    gatewayRef.current = { pg: "cashfree", cf_order_id: cfData.cf_order_id };

    const verifyAndFinalize = async (opts?: { attempts?: number; intervalMs?: number; showConfirming?: boolean }) => {
      const attempts = opts?.attempts ?? 8;
      const intervalMs = opts?.intervalMs ?? 2000;
      if (opts?.showConfirming) setConfirmingPayment(true);
      for (let i = 0; i < attempts; i++) {
        try {
          const verdict = await callEdgeFunction("store-cashfree-verify", {
            store_id: store.id, order_id: order.id, cf_order_id: cfData.cf_order_id,
          });
          if (verdict?.status === "PAID") {
            setConfirmingPayment(false); finishSuccess(order.id); return true;
          }
          if (verdict?.status === "FAILED" || verdict?.status === "CANCELLED") {
            setConfirmingPayment(false); return false;
          }
        } catch (e) { console.warn(`Cashfree verify attempt ${i + 1} failed:`, e); }
        if (i < attempts - 1) await new Promise((r) => setTimeout(r, intervalMs));
      }
      setConfirmingPayment(false);
      return false;
    };

    try {
      window.dispatchEvent(new CustomEvent("payment-in-progress"));
      fireInitiateCheckoutOnce();
      fireAddPaymentInfoOnce(isPartialOrder ? "partial_cod_cashfree" : "cashfree", chargeAmount);
      const result = await cashfree.checkout({
        paymentSessionId: cfData.payment_session_id, redirectTarget: "_modal",
      });
      if (result?.error) {
        const isCancel = result.error.code === "user_cancelled";
        const ok = await verifyAndFinalize(
          isCancel ? { attempts: 1, intervalMs: 0, showConfirming: false }
                   : { attempts: 8, intervalMs: 2000, showConfirming: true },
        );
        if (!ok) {
          setPendingOrder(order); setPaymentFailed(true);
          try { fireStorefrontEvent({ storeId: store.id, eventName: "payment_failed" as any, metadata: { order_id: order.id, gateway: "cashfree", cancel: isCancel } as any }); } catch { /* noop */ }
          if (!isCancel) toast.error(result.error.message || result.error.code || "Payment failed. You can retry below.");
        }
        return;
      }
      const ok = await verifyAndFinalize({ attempts: 8, intervalMs: 2000, showConfirming: true });
      if (!ok) {
        setPendingOrder(order); setPaymentFailed(true);
        toast.error("Payment not confirmed. You can retry below.");
      }
    } catch (err: any) {
      const ok = await verifyAndFinalize({ attempts: 8, intervalMs: 2000, showConfirming: true });
      if (!ok) {
        setPendingOrder(order); setPaymentFailed(true);
        toast.error(err?.message || "Payment failed. You can retry below.");
      }
    } finally {
      window.dispatchEvent(new CustomEvent("payment-ended"));
    }
  };

  const openPayu = async (order: PendingOrder) => {
    const returnUrl = buildPaymentReturnUrl();
    let payuData: any;
    try {
      payuData = await callEdgeFunction("payu-create-txn", {
        store_id: store.id, order_id: order.id,
        customer_name: fullName, customer_phone: phone, customer_email: email || undefined,
        return_url: returnUrl,
      });
    } catch (err: any) {
      setPendingOrder(order); setPaymentFailed(true);
      toast.error(err?.message || "Could not start payment. Please try again.");
      window.dispatchEvent(new CustomEvent("payment-ended"));
      return;
    }
    if (!payuData?.action || !payuData?.hash || !payuData?.key) {
      setPendingOrder(order); setPaymentFailed(true);
      toast.error("Payment gateway error. Please retry.");
      return;
    }
    gatewayRef.current = { pg: "payu", payu_txnid: payuData.txnid };
    try {
      const pendingPayload = JSON.stringify({
        order_id: order.id, order_number: order.number,
        txnid: payuData.txnid, is_partial: isPartialOrder,
        charge_amount: chargeAmount, total, ts: Date.now(),
      });
      sessionStorage.setItem(`payu_pending_${store.id}`, pendingPayload);
      localStorage.setItem(`payu_pending_${store.id}`, pendingPayload);
    } catch { /* noop */ }

    fireInitiateCheckoutOnce();
    fireAddPaymentInfoOnce(isPartialOrder ? "partial_cod_payu" : "payu", chargeAmount);
    window.dispatchEvent(new CustomEvent("payment-in-progress"));

    const verifyAndFinalize = async (opts?: { attempts?: number; intervalMs?: number; showConfirming?: boolean }) => {
      const attempts = opts?.attempts ?? 8;
      const intervalMs = opts?.intervalMs ?? 2000;
      if (opts?.showConfirming) setConfirmingPayment(true);
      for (let i = 0; i < attempts; i++) {
        try {
          const verdict = await callEdgeFunction("payu-verify-payment", {
            store_id: store.id, order_id: order.id, txnid: payuData.txnid,
          });
          if (verdict?.status === "PAID" || verdict?.success === true) {
            setConfirmingPayment(false);
            try { sessionStorage.removeItem(`payu_pending_${store.id}`); localStorage.removeItem(`payu_pending_${store.id}`); } catch { /* noop */ }
            finishSuccess(order.id);
            return true;
          }
          if (verdict?.status === "FAILED") { setConfirmingPayment(false); return false; }
        } catch (e) { console.warn(`PayU verify attempt ${i + 1} failed:`, e); }
        if (i < attempts - 1) await new Promise((r) => setTimeout(r, intervalMs));
      }
      setConfirmingPayment(false);
      return false;
    };

    try {
      const boltParams = {
        key: payuData.key, txnid: payuData.txnid, hash: payuData.hash,
        amount: payuData.amount, firstname: payuData.firstname,
        email: payuData.email, phone: payuData.phone, productinfo: payuData.productinfo,
        udf1: payuData.udf1 || "", udf2: payuData.udf2 || "", udf3: payuData.udf3 || "",
        udf4: payuData.udf4 || "", udf5: payuData.udf5 || "",
        surl: payuData.surl, furl: payuData.furl, curl: payuData.furl,
        notifyurl: payuData.notify_url || "", boltEnabled: "true", icp_source: "newBolt",
      };
      const bolt = await loadPayuBolt(payuData.env === "sandbox" ? "sandbox" : "production");

      await new Promise<void>((resolve) => {
        let settled = false;
        let timeoutId: number | null = null;
        const done = () => { if (timeoutId != null) window.clearTimeout(timeoutId); resolve(); };
        const finish = async (ok: boolean, cancelled = false) => {
          if (settled) return;
          settled = true;
          if (cancelled) {
            // User closed/backed out of Bolt — no need to poll verify, restore instantly
            setConfirmingPayment(false);
            setPendingOrder(order); setPaymentFailed(true);
            try { sessionStorage.removeItem(`payu_pending_${store.id}`); localStorage.removeItem(`payu_pending_${store.id}`); } catch { /* noop */ }
            done();
            return;
          }
          const confirmed = await verifyAndFinalize({ attempts: ok ? 10 : 3, intervalMs: 2000, showConfirming: true });
          if (!confirmed) {
            setPendingOrder(order); setPaymentFailed(true);
            try { fireStorefrontEvent({ storeId: store.id, eventName: "payment_failed" as any, metadata: { order_id: order.id, gateway: "payu" } as any }); } catch { /* noop */ }
            toast.error(ok ? "Payment not confirmed yet. You can retry below." : "Payment was not completed. You can retry below.");
          }
          done();
        };
        timeoutId = window.setTimeout(async () => {
          if (settled) return;
          const confirmed = await verifyAndFinalize({ attempts: 3, intervalMs: 2500, showConfirming: false });
          if (confirmed) { settled = true; done(); return; }
          settled = true;
          setConfirmingPayment(false);
          setPendingOrder(order); setPaymentFailed(true);
          toast.error("Payment not confirmed yet. If you paid, it will update automatically.");
          done();
        }, 90000);
        const isCancelStatus = (s: string) =>
          s === "cancel" || s === "cancelled" || s === "canceled" ||
          s === "usercancelled" || s === "user_cancelled" ||
          s === "closed" || s === "closedbyuser" || s === "dropped" ||
          s === "bolt_closed" || s === "userclosed";
        bolt.launch(boltParams, {
          responseHandler: (response: any) => {
            const rawStatus = String(response?.response?.status || response?.status || "").toLowerCase().replace(/[\s-]/g, "");
            if (isCancelStatus(rawStatus)) { void finish(false, true); return; }
            void finish(rawStatus === "success" || rawStatus === "captured");
          },
          catchException: (response: any) => {
            const rawStatus = String(response?.status || response?.response?.status || "").toLowerCase().replace(/[\s-]/g, "");
            const msg = String(response?.message || "").toLowerCase();
            const cancelled = isCancelStatus(rawStatus) || msg.includes("cancel") || msg.includes("closed") || msg.includes("user");
            console.warn("[PayU] Bolt exception", response, { cancelled });
            void finish(false, cancelled);
          },
        });

      });
      window.dispatchEvent(new CustomEvent("payment-ended"));
    } catch (err) {
      console.error("[PayU] Bolt failed to open", err);
      window.dispatchEvent(new CustomEvent("payment-ended"));
      setPendingOrder(order); setPaymentFailed(true);
      toast.error("PayU checkout could not open. Please retry.");
    }
  };

  // ─── "Pay with card/wallet" (opens active gateway modal) ────────────────
  const [openingGateway, setOpeningGateway] = useState(false);
  const startGatewayPayment = async () => {
    if (openingGateway) return;
    setOpeningGateway(true);
    try {
      const order = await createOrderIfNeeded(activeGateway || "razorpay");
      setShowPayment(true);
      try { fireStorefrontEvent({ storeId: store.id, eventName: "pay_click" as any, metadata: { method: activeGateway || "online" } as any }); } catch { /* noop */ }
      if (activeGateway === "razorpay") await openRazorpay(order);
      else if (activeGateway === "cashfree") await openCashfree(order);
      else if (activeGateway === "payu") await openPayu(order);
      else toast.error("No online payment gateway configured");
    } catch (e: any) {
      toast.error(e?.message || "Could not start payment");
    } finally {
      setOpeningGateway(false);
    }
  };

  const handleRetryPayment = async () => {
    if (!pendingOrder) return;
    setPaymentFailed(false);
    try {
      if (activeGateway === "cashfree") await openCashfree(pendingOrder);
      else if (activeGateway === "payu") await openPayu(pendingOrder);
      else if (activeGateway === "razorpay") await openRazorpay(pendingOrder);
    } catch (e: any) {
      setPaymentFailed(true);
      toast.error(e?.message || "Retry failed");
    }
  };

  // ─── COD (goes through checkout-v2-cod edge fn to enforce partial rules) ─
  const [placingCod, setPlacingCod] = useState(false);
  const placeCod = async () => {
    if (placingCod) return;
    const err = validateAddress();
    if (err) { toast.error(err); return; }
    setPlacingCod(true);
    try {
      saveExpressInfo();
      const order = await createOrderIfNeeded("cod");
      const { data, error } = await supabase.functions.invoke("checkout-v2-cod", {
        body: { store_id: store.id, order_id: order.id },
      });
      if (error) throw new Error(error.message);
      const res = data as { ok?: boolean; error?: string } | null;
      if (!res?.ok) throw new Error(res?.error || "Failed to place COD order");
      fireInitiateCheckoutOnce();
      fireAddPaymentInfoOnce("cod", total);
      finishSuccess(order.id);
    } catch (e: any) {
      toast.error(e.message || "Failed to place COD order");
    } finally {
      setPlacingCod(false);
    }
  };

  const forceRecheck = () => { manualRecheck(); };

  // ─── Loading skeletons ──────────────────────────────────────────────────
  if (isSingleMode && buyNowProductLoading && !buyNowProduct) {
    return (
      <div className="mx-auto max-w-md p-4 space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  // ─── Thank-you screen ───────────────────────────────────────────────────
  if (orderPlaced) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <CheckCircle2 className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">{tCritical("Order Placed!", "ऑर्डर हो गया!")}</h1>
        <p className="mt-2 text-muted-foreground">
          {tCritical("Your order has been placed successfully. The store will contact you shortly.", "आपका ऑर्डर सफलतापूर्वक दे दिया गया है।")}
        </p>
        {(orderNumber || orderId) && (
          <p className="mt-2 text-xs text-muted-foreground">
            Order ID: <span className="font-mono font-semibold">{orderNumber || orderId?.slice(0, 8)}</span>
          </p>
        )}
        <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-3">
          <p className="flex items-center justify-center gap-1.5 text-sm font-medium text-foreground">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" /> {tCritical("Order confirmed!", "ऑर्डर पुष्टि!")}
          </p>
          {(phone || email) && (
            <p className="mt-1 text-xs text-muted-foreground">
              We'll send updates to <strong>{phone}</strong>{email ? ` and ${email}` : ""}.
            </p>
          )}
        </div>

        {isPartialOrder && advancePaid > 0 && (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/30 p-3 text-left">
            <div className="text-xs font-semibold mb-2">{tCritical("Partial payment breakdown", "आंशिक भुगतान")}</div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Advance paid</span>
              <span className="font-semibold text-emerald-700">{formatPrice(advancePaid, currency)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Balance on delivery</span>
              <span className="font-semibold">{formatPrice(balanceDue, currency)}</span>
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-col items-center gap-2">
          <Button variant="outline" onClick={handleViewMyOrders} disabled={viewingOrders} className="h-10 px-6">
            {viewingOrders && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            View My Orders
          </Button>
          <Button onClick={() => navigate(storefrontPath(store.slug))} className="h-10 px-6">
            Continue Shopping
          </Button>
        </div>

        {showUpsell && orderId && (
          <div className="mt-8">
            <Suspense fallback={null}>
              <PostPurchaseUpsell
                storeId={store.id}
                storeName={store.name}
                orderId={orderId}
                orderNumber={orderNumber}
                orderedProductIds={checkoutItems.map((i) => i.productId)}
                currency={currency}
                onSkip={() => setShowUpsell(false)}
              />
            </Suspense>
          </div>
        )}
      </div>
    );
  }

  // ─── Empty cart guard (skip in buy-now single mode) ─────────────────────
  if (checkoutItems.length === 0 && !orderId && !isSingleMode) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <p className="text-muted-foreground">Your cart is empty.</p>
        <Button className="mt-4" onClick={() => navigate(storefrontPath(store.slug))}>Continue shopping</Button>
      </div>
    );
  }

  // ─── Waiting screen (UPI intent flow) ───────────────────────────────────
  if (waiting) {
    return (
      <div className="mx-auto max-w-md p-6 pt-16 text-center">
        <div className="mx-auto mb-6 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
        </div>
        <h1 className="text-xl font-bold mb-2">{tCritical(`Complete payment in ${waitingApp}`, `${waitingApp} में भुगतान पूरा करें`)}</h1>
        <p className="text-sm text-muted-foreground mb-8">
          Approve the payment request of <span className="font-semibold text-foreground">{formatPrice(chargeAmount, currency)}</span> in {waitingApp} to confirm your order.
        </p>
        <div className="rounded-lg border bg-muted/30 p-4 text-left text-xs text-muted-foreground mb-6">
          <div className="flex items-start gap-2">
            <ShieldCheck className="h-4 w-4 mt-0.5 text-emerald-600 flex-shrink-0" />
            <div>{tCritical("Do not close this page. We'll confirm automatically once you approve payment in the app.", "यह पेज बंद न करें।")}</div>
          </div>
        </div>
        <Button variant="outline" className="w-full" onClick={forceRecheck} disabled={manualChecking}>
          {manualChecking ? "Checking…" : "I've paid — check now"}
        </Button>
        <button className="mt-3 text-xs text-muted-foreground underline" onClick={() => { clearWaiting(); setWaiting(false); }}>
          Cancel and choose another method
        </button>
      </div>
    );
  }

  // ─── Phone gate (Step 1) — captures lead + abandoned_cart before form ───
  // Matches legacy checkout: forces phone entry as the first screen so we
  // create the abandoned_carts row (via CheckoutPhoneStep → capture_checkout_lead)
  // BEFORE the shopper can drop off on the address form. WhatsApp cart-recovery
  // cron then reaches out after 30 min.
  const needsPhone = !isValidIndianPhone(normalizePhone(phone));
  if (needsPhone) {
    return (
      <Suspense fallback={<div className="min-h-[70vh]" />}>
        <CheckoutPhoneStep
          storeId={store?.id}
          storeName={store?.name}
          cartItems={checkoutItems as any}
          onComplete={(p) => {
            setPhone(p);
            try { localStorage.setItem("checkout_phone", p); } catch { /* noop */ }
          }}
        />
      </Suspense>
    );
  }

  // ─── Main layout ────────────────────────────────────────────────────────
  const mobile = isMobile();

  return (
    <div className="mx-auto max-w-md min-h-screen bg-background pb-24">

      {/* Confirming payment overlay */}
      {confirmingPayment && (
        <div className="fixed inset-0 z-50 bg-background/85 backdrop-blur-sm flex items-center justify-center">
          <div className="text-center p-6 max-w-xs">
            <Loader2 className="h-10 w-10 text-primary animate-spin mx-auto mb-4" />
            <h3 className="font-semibold mb-1">{tCritical("Confirming your payment…", "भुगतान की पुष्टि हो रही है…")}</h3>
            <p className="text-xs text-muted-foreground">Please don't close this page. It can take up to 20 seconds.</p>
          </div>
        </div>
      )}

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

      {/* Payment retry banner */}
      {paymentFailed && pendingOrder && (
        <div className="m-4 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
          <div className="text-sm font-semibold text-destructive mb-1">{tCritical("Payment not completed", "भुगतान पूरा नहीं हुआ")}</div>
          <div className="text-xs text-muted-foreground mb-2">
            Your order <strong>{pendingOrder.number || pendingOrder.id.slice(0, 8)}</strong> is on hold — retry to complete payment.
          </div>
          <Button size="sm" className="w-full" onClick={handleRetryPayment}>Retry payment</Button>
        </div>
      )}

      {/* Contact + address (hidden once payment screen is shown) */}
      {!showPayment && (
        <div className="p-4 space-y-4">
          {/* Saved addresses (logged-in) */}
          {customer && savedAddresses && savedAddresses.length > 0 && (
            <div className="rounded-lg border p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-semibold flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> Saved address
                </div>
                <button className="text-xs text-primary underline" onClick={() => setShowAddressDialog(true)}>Change</button>
              </div>
              {(() => {
                const addr = savedAddresses.find((a: any) => a.id === selectedAddressId);
                if (!addr) return null;
                return (
                  <div className="text-xs">
                    <div className="font-semibold">{addr.full_name} · {addr.phone}</div>
                    <div className="text-muted-foreground">{addr.street_address}, {addr.city}, {addr.state} - {addr.pincode}</div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Returning-guest 1-tap */}
          {returningOrder && !returningUsed && (
            <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary mt-0.5" />
              <div className="flex-1">
                <div className="text-xs font-semibold">Welcome back, {returningOrder.customer_name?.split(" ")[0]}!</div>
                <div className="text-[11px] text-muted-foreground truncate">Load last address ({returningOrder.street_address?.slice(0, 30)}…)?</div>
              </div>
              <Button size="sm" className="h-7 text-xs px-3" onClick={applyReturningOrder}>Use it</Button>
              <button className="text-[11px] text-muted-foreground underline pl-1" onClick={() => setReturningDismissed(true)}>Skip</button>
            </div>
          )}

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
                <Label className="text-xs">Email {customer ? "" : "(optional)"}</Label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" type="email" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-xs">Pincode *</Label>
                  <button
                    type="button"
                    onClick={detectLocation}
                    disabled={geoLoading}
                    className="text-[11px] text-primary flex items-center gap-1 underline"
                  >
                    {geoLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <LocateFixed className="h-3 w-3" />}
                    Use my location
                  </button>
                </div>
                <div className="relative">
                  <Input value={pincode} onChange={(e) => setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="6-digit pincode" inputMode="numeric" maxLength={6} />
                  {pincodeLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
                </div>
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

              {/* WA consent */}
              <label className="flex items-start gap-2 text-[11px] text-muted-foreground pt-1">
                <Checkbox
                  checked={waConsent}
                  onCheckedChange={(v) => setWaConsent(v === true)}
                  className="mt-0.5"
                />
                <span>Send me order updates & offers on WhatsApp.</span>
              </label>
            </div>
          </div>

          {/* Coupon */}
          {hasActiveCoupons && (
            <div className="rounded-lg border p-3">
              {!appliedCoupon ? (
                !couponOpen ? (
                  <button
                    type="button"
                    onClick={() => setCouponOpen(true)}
                    className="w-full flex items-center gap-2 text-sm text-primary font-semibold"
                  >
                    <Tag className="h-4 w-4" /> Have a coupon code?
                  </button>
                ) : (
                  <div className="space-y-2">
                    <div className="text-xs font-semibold flex items-center gap-2">
                      <Tag className="h-4 w-4" /> Apply coupon
                    </div>
                    <div className="flex gap-2">
                      <Input
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                        placeholder="ENTER CODE"
                        className="uppercase"
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyCoupon(); } }}
                      />
                      <Button size="sm" onClick={() => applyCoupon()} disabled={couponLoading || !couponCode.trim()}>
                        {couponLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
                      </Button>
                    </div>
                  </div>
                )
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <div className="h-6 w-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                      <Check className="h-3 w-3" />
                    </div>
                    <div>
                      <div className="font-semibold">{appliedCoupon.code}</div>
                      <div className="text-[11px] text-emerald-600">−{formatPrice(couponDiscount, currency)} applied</div>
                    </div>
                  </div>
                  <button onClick={removeCoupon} className="text-muted-foreground hover:text-destructive" aria-label="Remove coupon">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Partial-payment selector */}
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
              {checkoutItems.map((it, idx) => (
                <div key={`${it.productId}-${it.variantId || ""}-${idx}`} className="flex justify-between">
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
            disabled={creatingOrder || !paymentConfigLoaded}
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
            return (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200 mb-3">
                <div className="font-semibold mb-1">UPI apps unavailable</div>
                <div className="mb-2 opacity-80">{firstErr}</div>
                {hasOnline && (
                  <Button size="sm" variant="outline" className="w-full" onClick={startGatewayPayment} disabled={openingGateway}>
                    {openingGateway ? <Loader2 className="h-4 w-4 animate-spin" /> : `Pay with ${activeGateway === "razorpay" ? "Card/Wallet" : activeGateway === "cashfree" ? "Cashfree" : "PayU"}`}
                  </Button>
                )}
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
                  className="w-full flex items-center justify-center gap-2 rounded-lg border-2 border-dashed p-3 hover:border-primary hover:bg-primary/5 active:scale-[0.99] transition-all disabled:opacity-40 mb-4"
                >
                  <img src="/icons/upi.png" alt="UPI" className="h-6 w-6 object-contain" />
                  <span className="text-sm font-semibold">Any UPI app</span>
                  {intents.any.status === "loading" && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                </button>
              </>
            )}

            {/* Card / wallet — opens gateway modal */}
            {hasOnline && (
              <button
                onClick={startGatewayPayment}
                disabled={openingGateway || confirmingPayment}
                className="w-full flex items-center justify-between gap-2 rounded-lg border-2 p-3 hover:border-primary hover:bg-primary/5 active:scale-[0.99] transition-all disabled:opacity-40 mb-3"
              >
                <div className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  <div className="text-left">
                    <div className="text-sm font-semibold">Card / Netbanking / Wallet</div>
                    <div className="text-[11px] text-muted-foreground">
                      Powered by {activeGateway === "razorpay" ? "Razorpay" : activeGateway === "cashfree" ? "Cashfree" : "PayU"}
                    </div>
                  </div>
                </div>
                {openingGateway ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowLeft className="h-4 w-4 rotate-180 text-muted-foreground" />}
              </button>
            )}

            {/* COD */}
            {hasCod && effectiveMode === "full" && (
              <button
                onClick={placeCod}
                disabled={placingCod || confirmingPayment}
                className="w-full flex items-center justify-between gap-2 rounded-lg border-2 p-3 hover:border-primary hover:bg-primary/5 active:scale-[0.99] transition-all disabled:opacity-40"
              >
                <div className="flex items-center gap-2">
                  <Banknote className="h-5 w-5 text-primary" />
                  <div className="text-left">
                    <div className="text-sm font-semibold">{tCritical("Cash on Delivery", "डिलीवरी पर कैश")}</div>
                    <div className="text-[11px] text-muted-foreground">Pay {formatPrice(total, currency)} when you receive the order</div>
                  </div>
                </div>
                {placingCod ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 text-muted-foreground" />}
              </button>
            )}

            {!hasOnline && !hasCod && paymentConfigLoaded && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
                {tCritical("This store has no payment methods configured. Please contact the store.", "इस स्टोर के लिए भुगतान विधि उपलब्ध नहीं है।")}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Address book dialog */}
      <Dialog open={showAddressDialog} onOpenChange={setShowAddressDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Choose delivery address</DialogTitle>
            <DialogDescription>Pick a saved address or add a new one.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {(savedAddresses || []).map((a: any) => (
              <button
                key={a.id}
                onClick={() => { selectAddress(a); setShowAddressDialog(false); }}
                className={`w-full text-left rounded-lg border-2 p-3 transition-colors ${a.id === selectedAddressId ? "border-primary bg-primary/5" : "border-border"}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${a.id === selectedAddressId ? "border-primary bg-primary" : "border-muted-foreground"}`}>
                    {a.id === selectedAddressId && <CheckCircle2 className="h-3 w-3 text-primary-foreground" />}
                  </div>
                  <span className="text-xs font-semibold">{a.label || "Home"}</span>
                  {a.is_default && <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded">Default</span>}
                </div>
                <div className="text-xs">
                  <div className="font-semibold">{a.full_name} · {a.phone}</div>
                  <div className="text-muted-foreground">{a.street_address}, {a.city}, {a.state} - {a.pincode}</div>
                </div>
              </button>
            ))}
          </div>
          {!showAddAddress ? (
            <Button variant="outline" className="w-full" onClick={() => setShowAddAddress(true)}>
              <Plus className="h-4 w-4 mr-1" /> Add new address
            </Button>
          ) : (
            <div className="space-y-2 border-t pt-3">
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Full name *" value={newAddr.full_name} onChange={(e) => setNewAddr({ ...newAddr, full_name: e.target.value })} />
                <Input placeholder="Phone *" value={newAddr.phone} onChange={(e) => setNewAddr({ ...newAddr, phone: e.target.value })} inputMode="numeric" maxLength={10} />
              </div>
              <Input placeholder="House / Street / Area *" value={newAddr.street_address} onChange={(e) => setNewAddr({ ...newAddr, street_address: e.target.value })} />
              <div className="grid grid-cols-3 gap-2">
                <Input placeholder="Pincode *" value={newAddr.pincode} onChange={(e) => setNewAddr({ ...newAddr, pincode: e.target.value.replace(/\D/g, "").slice(0, 6) })} inputMode="numeric" />
                <Input placeholder="City *" value={newAddr.city} onChange={(e) => setNewAddr({ ...newAddr, city: e.target.value })} />
                <Input placeholder="State *" value={newAddr.state} onChange={(e) => setNewAddr({ ...newAddr, state: e.target.value })} />
              </div>
              <Input placeholder="Label (Home / Office)" value={newAddr.label} onChange={(e) => setNewAddr({ ...newAddr, label: e.target.value })} />
              <div className="flex gap-2">
                <Button className="flex-1" onClick={saveNewAddress}>Save address</Button>
                <Button variant="outline" onClick={() => setShowAddAddress(false)}>Cancel</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
