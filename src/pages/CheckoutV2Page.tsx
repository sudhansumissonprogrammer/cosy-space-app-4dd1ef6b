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
import { normalizePhone, isValidIndianPhone, toCanonicalIndianPhone } from "@/lib/phoneUtils";
import { storefrontPath } from "@/lib/subdomain";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import { QRCodeSVG } from "qrcode.react";
const CheckoutPhoneStep = lazy(() => import("@/components/storefront/CheckoutPhoneStep"));
const PincodeSheet = lazy(() => import("@/components/storefront/PincodeSheet"));

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
  if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) return true;
  if (typeof window !== "undefined" && window.matchMedia?.("(max-width: 767px)").matches) return true;
  return false;
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
    const canon = toCanonicalIndianPhone(s);
    return canon || (s ? String(s).replace(/\D/g, "").slice(-10) : "");
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

  const detectLocation = async () => {
    if (!navigator?.geolocation) {
      toast.error("Geolocation not supported on this browser");
      return;
    }
    // Secure-context check (geolocation requires https or localhost)
    if (typeof window !== "undefined" && !window.isSecureContext) {
      toast.error("Location needs a secure (https) page");
      return;
    }
    // Preflight the permission state so we can give a real error instead of a silent fail
    try {
      const perm: any = await (navigator as any).permissions?.query?.({ name: "geolocation" });
      if (perm?.state === "denied") {
        toast.error("Location blocked. Enable it in your browser site settings, then retry.");
        return;
      }
    } catch { /* Permissions API not supported — continue */ }

    setGeoLoading(true);
    console.log("[UseMyLocation] requesting position…");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        console.log("[UseMyLocation] got position", pos.coords.latitude, pos.coords.longitude);
        try {
          const { data, error } = await supabase.functions.invoke("reverse-geocode", {
            body: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          });
          if (error) {
            console.error("[UseMyLocation] edge fn error", error);
            let detail = error.message;
            try { if ((error as any).context?.text) detail = await (error as any).context.text(); } catch { /* noop */ }
            throw new Error(detail || "Geocoding failed");
          }
          console.log("[UseMyLocation] response", data);
          const addr = (data as any)?.address ?? {};
          let filled = 0;
          if (addr.pincode) { setPincode(String(addr.pincode)); filled++; }
          if (addr.city) { setCity(String(addr.city)); filled++; }
          if (addr.state) { setState(String(addr.state)); filled++; }
          if (addr.street_address) { setStreetAddress(String(addr.street_address)); filled++; }
          if (filled === 0) toast.error("No address found at your location — enter it manually");
          else toast.success(`Filled ${filled} field${filled > 1 ? "s" : ""} from your location`);
        } catch (e: any) {
          console.error("[UseMyLocation] fetch failed", e);
          toast.error(e?.message || "Could not detect location");
        } finally {
          setGeoLoading(false);
        }
      },
      (err) => {
        console.error("[UseMyLocation] getCurrentPosition failed", err?.code, err?.message);
        setGeoLoading(false);
        // 1 = PERMISSION_DENIED, 2 = POSITION_UNAVAILABLE, 3 = TIMEOUT
        if (err?.code === 1) {
          const inIframe = typeof window !== "undefined" && window.self !== window.top;
          toast.error(
            inIframe
              ? "Location blocked in preview. Open the site in a new tab and allow location."
              : "Please allow location permission and try again"
          );
        } else if (err?.code === 2) {
          toast.error("Your device could not determine location. Please enter pincode manually.");
        } else if (err?.code === 3) {
          toast.error("Location request timed out. Please try again.");
        } else {
          toast.error(err?.message || "Could not get your location");
        }
      },
      { timeout: 15000, enableHighAccuracy: true, maximumAge: 60000 }
    );
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

  const autoAdvancedRef = useRef(false);



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
  const [showAddressFormSheet, setShowAddressFormSheet] = useState(false);
  const [newAddr, setNewAddr] = useState({ label: "Home", full_name: "", phone: "", street_address: "", apartment: "", city: "", state: "", pincode: "" });
  const [addrLabel, setAddrLabel] = useState<"Home" | "Work">("Home");
  const [apartment, setApartment] = useState("");

  const selectAddress = (addr: any) => {
    setSelectedAddressId(addr.id);
    setFullName(addr.full_name || "");
    setPhone(addr.phone || "");
    setStreetAddress(addr.street_address || "");
    setCity(addr.city || "");
    setState(addr.state || "");
    setPincode(addr.pincode || "");
  };

  const openAddressFormSheet = () => {
    setShowAddressDialog(false);
    setShowAddAddress(false);
    setShowAddressFormSheet(true);
  };

  const closeAddressFormSheet = () => {
    if (showAddressFormSheet) setShowAddressFormSheet(false);
    else navigate(-1);
  };

  // Lock body scroll while any bottom-sheet is open so the page behind
  // doesn't scroll and the sheet's own scroll container is the only one active.
  useEffect(() => {
    const anySheetOpen = showAddressFormSheet || showAddressDialog;
    if (!anySheetOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [showAddressFormSheet, showAddressDialog]);

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
      setNewAddr({ label: "Home", full_name: "", phone: "", street_address: "", apartment: "", city: "", state: "", pincode: "" });
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
    const canon = toCanonicalIndianPhone(phone);
    if (!canon) { setReturningOrder(null); return; }
    if (canon === lastLookedUpPhoneRef.current) return;
    lastLookedUpPhoneRef.current = canon;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from("orders")
          .select("id, customer_name, customer_phone, street_address, city, state, pincode, created_at")
          .eq("store_id", store.id)
          .eq("customer_phone", canon)
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
    const canonPhone = toCanonicalIndianPhone(phone);
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
  const newCheckoutToken = () => (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : `ct_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const [checkoutToken, setCheckoutToken] = useState<string>(() => newCheckoutToken());

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
      const canonPhone = toCanonicalIndianPhone(phone);
      localStorage.setItem("checkout_phone", canonPhone || normalizePhone(phone));
      localStorage.setItem(`express_checkout_${store.id}`, JSON.stringify({
        fullName, email, pincode, streetAddress, city, state, phone: canonPhone || normalizePhone(phone), waConsent,
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
          customer_phone: toCanonicalIndianPhone(phone) || normalizePhone(phone),
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
        phone: toCanonicalIndianPhone(phone) || normalizePhone(phone),
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
            email: email.trim(), phone: toCanonicalIndianPhone(phone) || normalizePhone(phone),
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
  const waitingStartedAtRef = useRef<number>(0);
  const waitingCheckInFlightRef = useRef(false);

  const WAIT_KEY = `sf_wait_v2_${store?.id}`;
  const persistWaiting = (app: UpiApp, label: string, override?: { orderId?: string | null; orderNumber?: string | null }) => {
    try {
      const payload = JSON.stringify({
        orderId: override?.orderId ?? orderId,
        orderNumber: override?.orderNumber ?? orderNumber,
        app, label, gateway: gatewayRef.current, ts: Date.now(),
      });
      waitingStartedAtRef.current = Date.now();
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

  const stopWaitingForPayment = (message?: string) => {
    clearWaiting();
    setWaiting(false);
    setConfirmingPayment(false);
    if (orderId) setPendingOrder({ id: orderId, number: orderNumber });
    setPaymentFailed(true);
    try { window.dispatchEvent(new Event("payment-ended")); } catch { /* noop */ }
    if (message) toast(message, { duration: 5000 });
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
      const normalized = toCanonicalIndianPhone(phone) || normalizePhone(phone);
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
    const maxAttempts = gatewayRef.current.pg ? 6 : 8;
    const checkNow = async (): Promise<boolean> => {
      if (waitingCheckInFlightRef.current) return false;
      waitingCheckInFlightRef.current = true;
      try {
        const gatewayResult = await forceGatewayVerify();
        if (normalizeGatewayResult(gatewayResult) === "success") { finishSuccess(); return true; }
        const { data } = await supabase.functions.invoke("order-payment-status", {
          body: { store_id: store.id, order_id: orderId },
        });
        const status = (data as any)?.payment_status;
        if (status === "success") { finishSuccess(); return true; }
        if (status === "failed") {
          toast.error("Payment failed — please try again");
          clearWaiting(); setWaiting(false); try { window.dispatchEvent(new Event("payment-ended")); } catch { /* noop */ }
          try { fireStorefrontEvent({ storeId: store.id, eventName: "payment_failed" as any, metadata: { order_id: orderId } as any }); } catch { /* noop */ }
          return true;
        }
      } catch { /* keep polling */ }
      finally { waitingCheckInFlightRef.current = false; }
      return false;
    };
    const poll = async () => {
      if (cancelled) return;
      attempts++;
      const done = await checkNow();
      if (done || cancelled) return;
      if (attempts >= maxAttempts) { stopWaitingForPayment("Payment not confirmed. If you paid, tap retry to check again."); return; }
      const delay = attempts < 5 ? 1500 : 2500;
      setTimeout(poll, delay);
    };
    setTimeout(poll, 800);
    const onFocus = () => { void checkNow(); };
    const onVis = () => { if (document.visibilityState === "visible") void checkNow(); };
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
      if (status === "failed") { toast.error("Payment failed — please try again"); clearWaiting(); setWaiting(false); try { window.dispatchEvent(new Event("payment-ended")); } catch { /* noop */ } return; }
      toast("Not confirmed yet — please complete the payment in your UPI app");
    } finally { setManualChecking(false); }
  };

  const tapUpiApp = (app: UpiApp) => {
    const s = intents[app];
    if (s.status !== "ready" || !s.url) return;
    const label = UPI_APPS.find((u) => u.key === app)?.label || "UPI";
    setWaitingApp(label);
    waitingStartedAtRef.current = Date.now();
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
      waitingStartedAtRef.current = saved.ts || Date.now();
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
    const normalizedPayuStatus = payuStatus.toLowerCase().replace(/[\s_-]/g, "");
    gatewayRef.current = { pg: "payu", payu_txnid: txnid };
    setOrderId(returnedOrderId);
    setOrderNumber(null);
    setShowPayment(true);
    if (["failed", "failure", "cancel", "cancelled", "canceled", "usercancelled", "dropped"].includes(normalizedPayuStatus)) {
      clearWaiting();
      setPendingOrder({ id: returnedOrderId, number: null });
      setPaymentFailed(true);
      setWaiting(false);
      try { window.dispatchEvent(new Event("payment-ended")); } catch { /* noop */ }
    } else {
      setWaitingApp("PayU");
      persistWaiting("any", "PayU", { orderId: returnedOrderId, orderNumber: null });
      setWaiting(true);
    }
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
            customer_name: fullName.trim(), customer_phone: toCanonicalIndianPhone(phone) || normalizePhone(phone),
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

  // Auto-advance to payment options once the address is complete — the
  // shopper sees UPI/Cards/COD tiles inline on the same page (no explicit
  // "Continue" tap needed). Guarded by a ref so it only fires once per fill.
  useEffect(() => {
    if (autoAdvancedRef.current) return;
    if (showPayment || creatingOrder) return;
    if (!paymentConfigLoaded) return;
    const filled = !!(pincode && streetAddress && city && state && fullName);
    if (!filled) return;
    autoAdvancedRef.current = true;
    void createOrderAndIntents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pincode, streetAddress, city, state, fullName, paymentConfigLoaded, showPayment, creatingOrder]);

  // Desktop QR: auto-start payment polling as soon as the UPI intent URL is
  // ready, so the moment the shopper scans + pays in any UPI app we detect it
  // and advance to success without waiting for a button tap.
  const desktopQrPollStartedRef = useRef(false);
  useEffect(() => {
    if (desktopQrPollStartedRef.current) return;
    if (isMobile()) return;
    if (!showPayment || waiting) return;
    if (!orderId) return;
    if (intents.any.status !== "ready" || !intents.any.url) return;
    desktopQrPollStartedRef.current = true;
    setWaitingApp("UPI QR");
    persistWaiting("any", "UPI QR");
    setWaiting(true);
    try { window.dispatchEvent(new Event("payment-in-progress")); } catch { /* noop */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPayment, intents.any.status, intents.any.url, orderId, waiting]);

  // Partial ↔ Full toggle: the previous order + UPI intent were minted for the
  // old amount and stamped with the old payment_type. Reset everything so the
  // next auto-advance recreates a fresh order (new checkout_token, new
  // advance_paid on the DB row, new intent URL with the correct amount).
  const lastPayModeRef = useRef(payMode);
  useEffect(() => {
    if (lastPayModeRef.current === payMode) return;
    lastPayModeRef.current = payMode;
    if (!orderId && !showPayment) return; // nothing to reset yet
    if (waiting || confirmingPayment || orderPlaced) return; // don't disrupt an in-flight payment
    setOrderId(null);
    setOrderNumber(null);
    setIntents({
      gpay: { status: "idle" }, phonepe: { status: "idle" },
      paytm: { status: "idle" }, any: { status: "idle" },
    });
    gatewayRef.current = {};
    autoAdvancedRef.current = false;
    desktopQrPollStartedRef.current = false;
    setCheckoutToken(newCheckoutToken());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payMode]);


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
        customer_name: fullName, customer_phone: toCanonicalIndianPhone(phone) || normalizePhone(phone), customer_email: email || undefined,
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
        customer_name: fullName, customer_phone: toCanonicalIndianPhone(phone) || normalizePhone(phone), customer_email: email || undefined,
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
            try { sessionStorage.removeItem(`payu_pending_${store.id}`); localStorage.removeItem(`payu_pending_${store.id}`); } catch { /* noop */ }
            try { fireStorefrontEvent({ storeId: store.id, eventName: "payment_failed" as any, metadata: { order_id: order.id, gateway: "payu" } as any }); } catch { /* noop */ }
            toast.error(ok ? "Payment not confirmed yet. You can retry below." : "Payment was not completed. You can retry below.");
          }
          done();
        };
        timeoutId = window.setTimeout(async () => {
          if (settled) return;
          const confirmed = await verifyAndFinalize({ attempts: 1, intervalMs: 0, showConfirming: false });
          if (confirmed) { settled = true; done(); return; }
          settled = true;
          setConfirmingPayment(false);
          setPendingOrder(order); setPaymentFailed(true);
          try { sessionStorage.removeItem(`payu_pending_${store.id}`); localStorage.removeItem(`payu_pending_${store.id}`); } catch { /* noop */ }
          toast.error("Payment not completed. You can retry below.");
          done();
        }, 6000);
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

  // ─── Waiting screen (UPI intent flow) — mobile only ─────────────────────
  // On desktop we keep the QR inline (see the desktop UPI QR card below) and
  // just show a small "waiting" strip there, so the shopper can still see the
  // QR code while completing payment in their phone's UPI app.
  if (waiting && isMobile()) {
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
  const needsPhone = !toCanonicalIndianPhone(phone);
  // Pincode gate (Step 1.5): once phone is captured we ask for pincode only,
  // then hydrate city/state via the existing autofill effect before showing
  // the full address form.
  const needsPincode = !needsPhone && !/^\d{6}$/.test(pincode);
  if (needsPhone || needsPincode) {
    return (
      <Suspense fallback={<div className="min-h-[70vh]" />}>
        <div className={needsPincode ? "pointer-events-none" : ""}>
          <CheckoutPhoneStep
            storeId={store?.id}
            storeName={store?.name}
            storeLogo={store?.logo_url}
            cartItems={checkoutItems as any}
            onComplete={(p) => {
              setPhone(p);
              try { localStorage.setItem("checkout_phone", toCanonicalIndianPhone(p) || p); } catch { /* noop */ }
            }}
          />
        </div>
        {needsPincode && (
          <PincodeSheet
            initial={pincode}
            onClose={() => { /* hard back → clear phone to reset */ setPhone(""); try { localStorage.removeItem("checkout_phone"); } catch { /* noop */ } }}
            onSubmit={(pc) => setPincode(pc)}
          />
        )}
      </Suspense>
    );
  }

  // ─── Main layout ────────────────────────────────────────────────────────
  const mobile = isMobile();

  const savedAddr = savedAddresses?.find((a: any) => a.id === selectedAddressId);
  const addressFilled = !!(pincode && streetAddress && city && state && fullName);
  const announcement = showPayment
    ? "Get Extra Discount on UPI"
    : addressFilled
    ? "Re-check the delivery address"
    : "Unlock Extra Discount In Next Step";
  const savedAmount = (appliedCoupon && couponDiscount > 0 ? couponDiscount : 0);

  return (
    <div className="mx-auto max-w-md min-h-screen bg-[#F5F5F5] pb-32">

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

      {/* Header: back • logo • Secured payment */}
      <div className="sticky top-0 z-20 bg-white border-b border-[#ECECEC] px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} aria-label="Back" className="p-1 -ml-1">
          <ArrowLeft className="h-5 w-5" />
        </button>
        {store?.logo_url ? (
          <img src={store.logo_url} alt={store.name} className="h-8 w-auto max-w-[100px] object-contain" />
        ) : (
          <div className="text-sm font-bold truncate max-w-[140px]">{store?.name || "Store"}</div>
        )}
        <div className="flex-1" />
        <div className="text-[13px] text-muted-foreground flex items-center gap-1">
          100% Secured Payment <Lock className="h-3.5 w-3.5" />
        </div>
      </div>

      {/* Announcement bar */}
      <div className="sticky top-[57px] z-10 bg-black text-white text-[13px] font-semibold text-center py-2.5 px-4">
        {announcement}
      </div>

      {/* Payment retry banner */}
      {paymentFailed && pendingOrder && (
        <div className="m-4 rounded-xl border border-destructive/40 bg-destructive/5 p-3">
          <div className="text-sm font-semibold text-destructive mb-1">{tCritical("Payment not completed", "भुगतान पूरा नहीं हुआ")}</div>
          <div className="text-xs text-muted-foreground mb-2">
            Your order <strong>{pendingOrder.number || pendingOrder.id.slice(0, 8)}</strong> is on hold — retry to complete payment.
          </div>
          <Button size="sm" className="w-full bg-black hover:bg-black/90" onClick={handleRetryPayment}>Retry payment</Button>
        </div>
      )}

      {/* ═══════ CONTACT + ADDRESS STEP (always visible) ═══════ */}
      {true && (
        <div className="px-3 py-3 space-y-3">

          {/* Order Summary card */}
          <div className="bg-white rounded-xl border border-[#ECECEC] p-3.5">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-md bg-[#F5F5F5] flex items-center justify-center flex-shrink-0">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2 3h2l3 12h12l2-8H6"/><circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/></svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[15px] font-bold">Order Summary</div>
                {savedAmount > 0 && (
                  <div className="inline-block mt-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[12px] font-semibold">
                    {formatPrice(savedAmount, currency)} saved so far
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className="text-[11px] text-muted-foreground">{checkoutItems.length} item{checkoutItems.length !== 1 ? "s" : ""}</div>
                <div className="flex items-baseline gap-1.5 justify-end">
                  {savedAmount > 0 && <span className="text-[12px] text-muted-foreground line-through">{formatPrice(subtotal, currency)}</span>}
                  <span className="text-[15px] font-bold">{formatPrice(total, currency)}</span>
                </div>
              </div>
            </div>
            {/* Line items */}
            <div className="border-t border-[#ECECEC] mt-3 pt-2.5 space-y-1">
              {checkoutItems.map((it, idx) => (
                <div key={`${it.productId}-${it.variantId || ""}-${idx}`} className="flex justify-between text-[12px] text-muted-foreground">
                  <span className="truncate flex-1 pr-2">{it.name} × {it.quantity}</span>
                  <span>{formatPrice(it.price * it.quantity, currency)}</span>
                </div>
              ))}
              {shippingActive && (
                <div className="flex justify-between text-[12px] text-muted-foreground">
                  <span>Shipping</span>
                  <span>{shippingCharge > 0 ? formatPrice(shippingCharge, currency) : "Free"}</span>
                </div>
              )}
              {taxActive && !taxInclusive && (
                <div className="flex justify-between text-[12px] text-muted-foreground">
                  <span>{taxName} ({taxRate}%)</span>
                  <span>{formatPrice(taxAmount, currency)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Delivery Details (once address filled) */}
          {addressFilled && (
            <>
              <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-1 pt-1">Delivery Details</div>
              <div className="bg-white rounded-xl border border-[#ECECEC] p-3.5">
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="text-[14px] font-bold">Deliver To {fullName}</div>
                      <button
                        onClick={openAddressFormSheet}
                        className="relative bg-black text-white text-[11px] font-semibold px-2 py-1 rounded-md"
                      >
                        Tap To Edit Address
                        <span className="absolute -bottom-1 left-4 w-2 h-2 bg-black rotate-45" />
                      </button>
                    </div>
                    <div className="text-[13px] text-foreground/80 mt-0.5">
                      {streetAddress}
                    </div>
                    <div className="text-[13px] text-foreground/80">
                      {city}, {state}, {pincode}
                    </div>
                    <div className="text-[12px] text-muted-foreground mt-1">
                      +91 {phone}{email ? <> &nbsp;|&nbsp; <span className="truncate">{email}</span></> : null}
                    </div>
                  </div>
                  <button
                    onClick={openAddressFormSheet}
                    className="text-[13px] font-semibold border border-[#111] rounded-md px-3 py-1.5"
                  >Change</button>
                </div>
                {shippingActive && (
                  <div className="mt-3 pt-3 border-t border-[#ECECEC] bg-[#F9FAFB] -mx-3.5 -mb-3.5 px-3.5 py-2.5 rounded-b-xl">
                    <div className="text-[13px] font-semibold">
                      {shippingCharge > 0 ? `Shipping ${formatPrice(shippingCharge, currency)}` : "Free Shipping"}
                    </div>
                    {shippingCharge === 0 && <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded-md bg-emerald-600 text-white text-[11px] font-semibold">Free</span>}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Offers & Rewards */}
          {/* Offers & Rewards — always visible */}
          {(
            true) && (
            <>
              <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-1 pt-1">Offers & Rewards</div>
              <div className="bg-white rounded-xl border border-[#ECECEC] overflow-hidden">
                {savedAmount > 0 && (
                  <div className="bg-emerald-50 text-emerald-700 text-[13px] font-semibold text-center py-2">
                    You saved {formatPrice(savedAmount, currency)}
                  </div>
                )}
                <div className="p-3.5">
                  {!appliedCoupon ? (
                    <div className="flex gap-2">
                      <Input
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                        placeholder="Enter coupon code"
                        className="h-11 rounded-lg border-[#ECECEC] uppercase"
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyCoupon(); } }}
                      />
                      <Button size="sm" onClick={() => applyCoupon()} disabled={couponLoading || !couponCode.trim()} className="h-11 px-4 bg-black hover:bg-black/90">
                        {couponLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-7 w-7 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                          <Check className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="text-[14px] font-bold">"{appliedCoupon.code}" applied</div>
                          <div className="text-[12px] text-muted-foreground">View all coupons ›</div>
                        </div>
                      </div>
                      <button onClick={removeCoupon} className="text-[13px] font-semibold">
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Contact + Address form (only if not filled) — bottom-sheet popup */}
          {(!addressFilled || showAddressFormSheet) && (
            <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Add delivery address">
              {/* Backdrop */}
              <div
                className="absolute inset-0 bg-black/60 animate-in fade-in duration-200"
                onClick={closeAddressFormSheet}
                aria-hidden
              />
              {/* Sheet — full-width on mobile, centered on desktop, slides up */}
              <div className="absolute inset-x-0 bottom-0 mx-auto w-full sm:max-w-md">
                <div className="bg-white rounded-t-2xl shadow-2xl flex flex-col max-h-[92dvh] animate-in slide-in-from-bottom duration-300">
                  {/* Grab handle */}
                  <div className="pt-2.5 pb-1 flex justify-center flex-shrink-0">
                    <span className="h-1.5 w-10 rounded-full bg-gray-300" />
                  </div>
                  {/* Header */}
                  <div className="px-5 pt-1 pb-3 flex items-center justify-between border-b border-[#ECECEC] flex-shrink-0">
                    <div className="text-[16px] font-bold">Add Delivery Address</div>
                    <button
                      type="button"
                      onClick={closeAddressFormSheet}
                      aria-label="Close"
                      className="h-8 w-8 rounded-full hover:bg-gray-100 flex items-center justify-center -mr-1"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  {/* Scrollable body */}
                  <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-3 pb-4 space-y-3">
                  {/* Returning-guest 1-tap */}
                  {returningOrder && !returningUsed && (
                    <div className="rounded-lg border border-primary/40 bg-primary/5 p-2.5 flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary mt-0.5" />
                      <div className="flex-1">
                        <div className="text-xs font-semibold">Welcome back, {returningOrder.customer_name?.split(" ")[0]}!</div>
                        <div className="text-[11px] text-muted-foreground truncate">Load last address?</div>
                      </div>
                      <Button size="sm" className="h-7 text-xs px-3" onClick={applyReturningOrder}>Use it</Button>
                      <button className="text-[11px] text-muted-foreground underline pl-1" onClick={() => setReturningDismissed(true)}>Skip</button>
                    </div>
                  )}

                  <div>
                    <Label className="text-[12px] text-muted-foreground">Pincode *</Label>
                    <div className="relative">
                      <Input value={pincode} onChange={(e) => setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="6-digit pincode" inputMode="numeric" maxLength={6} className="h-11 rounded-lg border-[#ECECEC]" />
                      {pincodeLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
                    </div>
                    <button type="button" onClick={detectLocation} disabled={geoLoading} className="text-[11px] text-primary flex items-center gap-1 underline mt-1">
                      {geoLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <LocateFixed className="h-3 w-3" />}
                      Use my location
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[12px] text-muted-foreground">City *</Label>
                      <Input value={city} onChange={(e) => setCity(e.target.value)} className="h-11 rounded-lg border-[#ECECEC]" />
                    </div>
                    <div>
                      <Label className="text-[12px] text-muted-foreground">State *</Label>
                      <Input value={state} onChange={(e) => setState(e.target.value)} className="h-11 rounded-lg border-[#ECECEC]" />
                    </div>
                  </div>

                  <div>
                    <Label className="text-[12px] text-muted-foreground">Flat, House no. *</Label>
                    <Input value={streetAddress} onChange={(e) => setStreetAddress(e.target.value)} placeholder="Enter flat, house no." className="h-11 rounded-lg border-[#ECECEC]" />
                  </div>

                  <div>
                    <Label className="text-[12px] text-muted-foreground">Apartment, Area, Sector, Village</Label>
                    <Input value={apartment} onChange={(e) => setApartment(e.target.value)} placeholder="Apartment, area, sector, village" className="h-11 rounded-lg border-[#ECECEC]" />
                  </div>

                  <div className="pt-2 border-t border-[#ECECEC]">
                    <div className="text-[14px] font-bold mb-2">Customer Information</div>
                    <div className="space-y-3">
                      <div>
                        <Label className="text-[12px] text-muted-foreground">Full Name *</Label>
                        <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" className="h-11 rounded-lg border-[#ECECEC]" />
                      </div>
                      <div>
                        <Label className="text-[12px] text-muted-foreground">Email Address {customer ? "" : "*"}</Label>
                        <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" type="email" className="h-11 rounded-lg border-[#ECECEC]" />
                      </div>
                    </div>
                  </div>

                  {/* Save Address As */}
                  <div className="pt-2 border-t border-[#ECECEC]">
                    <div className="text-[13px] font-semibold mb-2">Save Address As</div>
                    <div className="flex gap-2">
                      {(["Home", "Work"] as const).map((lbl) => (
                        <button
                          key={lbl}
                          type="button"
                          onClick={() => setAddrLabel(lbl)}
                          className={`flex items-center gap-2 rounded-lg px-4 py-2 border ${addrLabel === lbl ? "border-black" : "border-[#ECECEC]"}`}
                        >
                          <span className="text-[13px] font-semibold">{lbl}</span>
                          <span className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${addrLabel === lbl ? "border-black" : "border-muted-foreground/40"}`}>
                            {addrLabel === lbl && <span className="h-2 w-2 rounded-full bg-black" />}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Shipping Method inline */}
                  {shippingActive && (
                    <div className="pt-2 border-t border-[#ECECEC]">
                      <div className="rounded-lg border border-[#ECECEC] bg-[#F9FAFB] p-3">
                        <div className="text-[13px] font-semibold mb-2">Shipping Method</div>
                        <div className="rounded-lg border border-[#ECECEC] bg-white p-3 flex items-center justify-between">
                          <div>
                            <div className="text-[13px] font-semibold">{shippingCharge > 0 ? formatPrice(shippingCharge, currency) + " Shipping" : "Free Shipping"}</div>
                            {shippingCharge === 0 && <span className="inline-block mt-1 px-1.5 py-0.5 rounded-md bg-emerald-600 text-white text-[10px] font-bold">Free</span>}
                          </div>
                          <span className="h-4 w-4 rounded-full border-2 border-black flex items-center justify-center">
                            <span className="h-2 w-2 rounded-full bg-black" />
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  <label className="flex items-start gap-2 text-[12px] text-muted-foreground pt-1">
                    <Checkbox checked={waConsent} onCheckedChange={(v) => setWaConsent(v === true)} className="mt-0.5" />
                    <span>Send me order updates & offers - (no spam)</span>
                  </label>
                  </div>
                  {/* Sticky Continue */}
                  <div className="flex-shrink-0 border-t border-[#ECECEC] p-3 bg-white pb-[max(env(safe-area-inset-bottom),0.75rem)]">
                    <Button
                      className="w-full h-12 text-[15px] font-bold bg-black hover:bg-black/90 disabled:bg-gray-300 disabled:text-white rounded-lg"
                      onClick={() => {
                        if (!fullName.trim()) { toast.error("Full name required"); return; }
                        if (!/^\d{6}$/.test(pincode)) { toast.error("Enter a valid pincode"); return; }
                        if (!streetAddress.trim()) { toast.error("Enter Flat, House no."); return; }
                        if (!city.trim() || !state.trim()) { toast.error("Enter city and state"); return; }
                        if (!customer && !email.trim()) { toast.error("Email address is required"); return; }
                        setShowAddressFormSheet(false);
                      }}
                    >
                      Continue
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Partial-payment selector moved into payment section below */}


          {/* Trust footer only shown when payment step isn't below */}
          {!showPayment && !(pincode && streetAddress && city && state && fullName) && (
            <div className="pt-6 pb-2 text-center">
              <div className="text-[11px] text-muted-foreground mb-1">Powered by</div>
              <div className="text-[14px] font-bold tracking-tight">{store?.name || "Storivo"}</div>
              <div className="text-[12px] text-muted-foreground mt-3">Powering secure checkout for 10,000+ brands</div>
              <div className="flex items-center justify-center gap-4 mt-3 text-muted-foreground">
                <div className="flex items-center gap-1 text-[11px]"><ShieldCheck className="h-4 w-4" /> PCI DSS<br/>Certified</div>
                <div className="flex items-center gap-1 text-[11px]"><Lock className="h-4 w-4" /> Secured<br/>Payments</div>
                <div className="flex items-center gap-1 text-[11px]"><CheckCircle2 className="h-4 w-4" /> Verified<br/>Merchant</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════ PAYMENT STEP (inline, below address) ═══════ */}
      {showPayment && (
        <div className="px-3 pb-3 space-y-3">

          {/* Partial-payment mode selector — prominent, above tiles */}
          {hasPartial && (
            <div className="bg-white rounded-xl border border-[#ECECEC] p-3.5">
              <div className="flex items-center gap-2 mb-2">
                <div className="text-[13px] font-bold">Choose payment plan</div>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">Recommended</span>
              </div>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setPayMode("partial")}
                  className={`w-full text-left rounded-lg border-2 p-3 transition-colors ${payMode === "partial" ? "border-black bg-black/5" : "border-[#ECECEC]"}`}
                >
                  <div className="flex items-start gap-2">
                    <div className={`mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${payMode === "partial" ? "border-black bg-black" : "border-muted-foreground"}`}>
                      {payMode === "partial" && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold">Pay {formatPrice(partialAdvanceTotal, currency)} advance now</div>
                      <div className="text-[12px] text-muted-foreground mt-0.5">Balance {formatPrice(partialBalanceDue, currency)} on delivery (Cash)</div>
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setPayMode("full")}
                  className={`w-full text-left rounded-lg border-2 p-3 transition-colors ${payMode === "full" ? "border-black bg-black/5" : "border-[#ECECEC]"}`}
                >
                  <div className="flex items-start gap-2">
                    <div className={`mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${payMode === "full" ? "border-black bg-black" : "border-muted-foreground"}`}>
                      {payMode === "full" && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold">Pay full {formatPrice(total, currency)} online</div>
                      <div className="text-[12px] text-muted-foreground mt-0.5">Nothing to pay on delivery</div>
                    </div>
                  </div>
                </button>
              </div>
              {isPartialOrder && (
                <div className="mt-2.5 flex items-start gap-2 rounded-lg bg-emerald-50 px-2.5 py-2 text-[11px] text-emerald-800">
                  <ShieldCheck className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                  <span>You'll pay only <strong>{formatPrice(partialAdvanceTotal, currency)}</strong> now to confirm this order. Remaining <strong>{formatPrice(partialBalanceDue, currency)}</strong> is paid in cash when delivered.</span>
                </div>
              )}
              {(creatingOrder || intents.any.status === "loading") && (
                <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Updating amount…
                </div>
              )}
            </div>
          )}




          {(() => {
            const allFailed = (["gpay","phonepe","paytm","any"] as UpiApp[]).every((k) => intents[k].status === "failed");
            if (!allFailed) return null;
            const firstErr = intents.any.error || intents.gpay.error || "UPI is temporarily unavailable";
            return (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
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

          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-1 pt-1">Payment Options</div>

          {/* UPI card */}
          {mobile && (
            <div className="relative bg-white rounded-xl border border-[#ECECEC] p-3.5">

              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded bg-gradient-to-br from-orange-500 to-blue-600" />
                  <div className="text-[15px] font-bold">UPI</div>
                </div>
                <div className="text-[15px] font-bold">{formatPrice(chargeAmount, currency)}</div>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {UPI_APPS.slice(0, 3).map((app, i) => {
                  const s = intents[app.key];
                  const disabled = s.status !== "ready";
                  const bg = ["bg-sky-50", "bg-purple-50", "bg-rose-50"][i] || "bg-gray-50";
                  return (
                    <button
                      key={app.key}
                      onClick={() => tapUpiApp(app.key)}
                      disabled={disabled}
                      className={`flex flex-col items-center justify-center rounded-lg ${bg} active:scale-95 transition-all p-2.5 disabled:opacity-40 disabled:cursor-not-allowed min-h-[92px] relative`}
                    >
                      
                      <img src={app.icon} alt={app.label} className="h-8 w-8 mt-3 mb-1 object-contain" />
                      <div className="text-[11px] font-semibold">{app.label}</div>
                      {s.status === "loading" && <Loader2 className="h-3 w-3 animate-spin mt-1 text-muted-foreground" />}
                    </button>
                  );
                })}
                <button
                  onClick={() => tapUpiApp("any")}
                  disabled={intents.any.status !== "ready"}
                  className="flex flex-col items-center justify-center rounded-lg bg-gray-50 active:scale-95 transition-all p-2.5 disabled:opacity-40 min-h-[92px]"
                >
                  <div className="h-8 w-8 mt-3 mb-1 rounded-full bg-black flex items-center justify-center text-white text-[10px] font-bold">UPI</div>
                  <div className="text-[11px] font-semibold">Any App</div>
                  {intents.any.status === "loading" && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                </button>
              </div>
              <button
                onClick={() => tapUpiApp("any")}
                disabled={intents.any.status !== "ready"}
                className="mt-3 w-full flex items-center justify-between border border-[#ECECEC] rounded-lg px-3 py-2.5 active:scale-[0.99] disabled:opacity-40"
              >
                <span className="text-[13px] font-semibold">All UPI Apps</span>
                <span className="flex items-center gap-2 text-[12px] text-muted-foreground font-semibold">
                  Pay with any UPI app
                  <ArrowLeft className="h-4 w-4 rotate-180 text-muted-foreground" />
                </span>
              </button>
            </div>
          )}

          {/* Desktop: UPI QR — scan with any UPI app to pay */}
          {!mobile && (
            <div className="relative bg-white rounded-xl border border-[#ECECEC] p-4">

              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded bg-gradient-to-br from-orange-500 to-blue-600" />
                  <div className="text-[15px] font-bold">Pay via UPI QR</div>
                </div>
                <div className="text-[15px] font-bold">{formatPrice(chargeAmount, currency)}</div>
              </div>
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 rounded-lg border border-[#ECECEC] p-3 bg-white">
                  {intents.any.status === "ready" && intents.any.url ? (
                    <QRCodeSVG value={intents.any.url} size={168} level="M" includeMargin={false} />
                  ) : (
                    <div className="h-[168px] w-[168px] flex items-center justify-center bg-[#F5F5F5] rounded">
                      {intents.any.status === "failed" ? (
                        <span className="text-[11px] text-destructive text-center px-2">QR unavailable</span>
                      ) : (
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      )}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0 text-[13px] space-y-2">
                  <div className="font-semibold text-[14px]">Scan & Pay from any UPI app</div>
                  <ol className="list-decimal ml-4 space-y-1 text-muted-foreground text-[12px]">
                    <li>Open GPay, PhonePe, Paytm, or any UPI app</li>
                    <li>Scan this QR code</li>
                    <li>Complete the payment — we'll confirm automatically</li>
                  </ol>
                  <div className="flex items-center gap-2 pt-1">
                    <img src="/icons/gpay.svg" alt="GPay" className="h-5 w-5 object-contain" />
                    <img src="/icons/phonepe.svg" alt="PhonePe" className="h-5 w-5 object-contain" />
                    <img src="/icons/paytm.svg" alt="Paytm" className="h-5 w-5 object-contain" />
                    <img src="/icons/upi.png" alt="UPI" className="h-5 w-auto object-contain" />
                  </div>
                  {intents.any.status === "ready" && !waiting && (
                    <button
                      onClick={() => {
                        setWaitingApp("UPI QR");
                        setWaiting(true);
                        persistWaiting("any", "UPI QR");
                        try { window.dispatchEvent(new Event("payment-in-progress")); } catch { /* noop */ }
                      }}
                      className="mt-1 text-[12px] font-semibold text-primary underline"
                    >
                      I've scanned — waiting for confirmation
                    </button>
                  )}
                  {waiting && (
                    <div className="mt-1 flex items-center gap-2 text-[12px] text-emerald-700">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Waiting for payment confirmation…
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Cards / Netbanking / Wallets — single consolidated gateway tile */}
          {hasOnline && (
            <button
              onClick={startGatewayPayment}
              disabled={openingGateway || confirmingPayment}
              className="w-full bg-white rounded-xl border border-[#ECECEC] p-3.5 flex items-center justify-between active:scale-[0.99] transition-all disabled:opacity-40"
            >
              <div className="flex items-center gap-3">
                <CreditCard className="h-5 w-5" />
                <div className="text-left">
                  <div className="text-[14px] font-bold">Cards, Netbanking & Wallets</div>
                  <div className="text-[11px] text-muted-foreground">Visa, Mastercard, RuPay, all major banks</div>
                </div>
              </div>
              <div className="flex items-center gap-1 text-[14px] font-bold">
                {formatPrice(chargeAmount, currency)}
                {openingGateway ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : <ArrowLeft className="h-4 w-4 rotate-180 text-muted-foreground ml-1" />}
              </div>
            </button>
          )}


          {/* COD */}
          {hasCod && effectiveMode === "full" && (
            <button
              onClick={placeCod}
              disabled={placingCod || confirmingPayment}
              className="relative w-full bg-white rounded-xl border border-[#ECECEC] p-3.5 flex items-center justify-between active:scale-[0.99] transition-all disabled:opacity-40"
            >
              
              <div className="flex items-center gap-3">
                <Banknote className="h-5 w-5" />
                <div className="text-left">
                  <div className="text-[14px] font-bold">{tCritical("Cash on Delivery", "डिलीवरी पर कैश")}</div>
                </div>
              </div>
              <div className="flex items-center gap-1 text-[14px] font-bold">
                {formatPrice(total, currency)}
                {placingCod ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : <ArrowLeft className="h-4 w-4 rotate-180 text-muted-foreground ml-1" />}
              </div>
            </button>
          )}

          {!hasOnline && !hasCod && paymentConfigLoaded && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
              {tCritical("This store has no payment methods configured. Please contact the store.", "इस स्टोर के लिए भुगतान विधि उपलब्ध नहीं है।")}
            </div>
          )}

          {/* Logged-in strip */}
          {customer && (
            <div className="bg-white rounded-xl border border-[#ECECEC] p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-[#F5F5F5] flex items-center justify-center">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-7 8-7s8 3 8 7"/></svg>
                </div>
                <div className="text-[13px]">Logged in using +91 {phone}</div>
              </div>
            </div>
          )}

          {/* Trust footer */}
          <div className="pt-6 pb-2 text-center">
            <div className="text-[11px] text-muted-foreground mb-1">Powered by</div>
            <div className="text-[14px] font-bold tracking-tight">{store?.name || "Storivo"}</div>
            <div className="text-[12px] text-muted-foreground mt-3">Powering secure checkout for 10,000+ brands</div>
            <div className="flex items-center justify-center gap-4 mt-3 text-muted-foreground">
              <div className="flex items-center gap-1 text-[11px]"><ShieldCheck className="h-4 w-4" /> PCI DSS<br/>Certified</div>
              <div className="flex items-center gap-1 text-[11px]"><Lock className="h-4 w-4" /> Secured<br/>Payments</div>
              <div className="flex items-center gap-1 text-[11px]"><CheckCircle2 className="h-4 w-4" /> Verified<br/>Merchant</div>
            </div>
          </div>
        </div>
      )}

      {/* Sticky bottom Continue (contact step only) */}
      {!showPayment && !(pincode && streetAddress && city && state && fullName) && (
        <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-[#ECECEC] p-3">
          <Button
            className="w-full h-12 text-[15px] font-bold bg-black hover:bg-black/90 disabled:bg-gray-300 disabled:text-white rounded-lg"
            onClick={createOrderAndIntents}
            disabled={creatingOrder || !paymentConfigLoaded}
          >
            {creatingOrder ? <Loader2 className="h-5 w-5 animate-spin" /> : "Continue"}
          </Button>
          <div className="text-[10px] text-center text-muted-foreground mt-1.5">
            By proceeding, I agree to the store's Privacy Policy and T&amp;C
          </div>
        </div>
      )}

      {/* Address book dialog (saved addresses sheet) */}
      {/* Address book bottom-sheet */}
      {showAddressDialog && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50"
            onClick={() => { setShowAddressDialog(false); setShowAddAddress(false); }}
            aria-hidden
          />
          <div className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[100dvh] max-w-md flex-col justify-end overflow-hidden pointer-events-none">
            <div className="pointer-events-auto flex flex-col items-center">
          <button
            type="button"
            onClick={() => { setShowAddressDialog(false); setShowAddAddress(false); }}
            aria-label="Close"
            className="relative z-10 mx-auto mb-3 h-10 w-10 flex-shrink-0 rounded-full bg-white shadow-md flex items-center justify-center"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="relative z-10 w-full bg-white rounded-t-2xl flex max-h-[calc(100dvh-72px)] flex-col overflow-hidden shadow-2xl">
            {!showAddAddress ? (
              <>
                <div className="px-5 pt-5 pb-3 flex items-center justify-between">
                  <div className="text-[16px] font-semibold">Select Delivery Address</div>
                  <button
                    className="text-[13px] font-semibold border border-[#111] rounded-full px-3 py-1.5"
                    onClick={() => setShowAddAddress(true)}
                  >
                    + Add New Address
                  </button>
                </div>
                <div className="min-h-0 flex-1 px-4 pb-5 space-y-3 overflow-y-auto">
                  {(savedAddresses || []).map((a: any) => (
                    <div key={a.id} className="rounded-xl border border-[#ECECEC] p-3.5">
                      <div className="flex items-start justify-between mb-1">
                        <div className="text-[14px] font-bold">
                          {a.full_name}
                          <span className="ml-2 text-[11px] bg-sky-100 text-sky-700 rounded px-1.5 py-0.5 font-semibold">
                            {a.label || "Home"}
                          </span>
                        </div>
                        <button className="text-muted-foreground" aria-label="Edit">
                          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
                        </button>
                      </div>
                      <div className="text-[13px] text-foreground/80">
                        {a.street_address}, {a.city}, {a.state}, {a.pincode}
                      </div>
                      {a.email && (
                        <div className="text-[12px] text-muted-foreground mt-0.5">{a.email}</div>
                      )}
                      <button
                        onClick={() => { selectAddress(a); setShowAddressDialog(false); }}
                        className="w-full mt-3 bg-black text-white rounded-lg py-3 text-[14px] font-bold"
                      >Deliver Here</button>
                    </div>
                  ))}
                  {(savedAddresses || []).length === 0 && (
                    <div className="text-center text-sm text-muted-foreground py-8">
                      No saved addresses yet. Tap "+ Add New Address" to add one.
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="px-5 pt-5 pb-2 text-[16px] font-semibold">Add Delivery Address</div>
                <div className="min-h-0 flex-1 px-4 pb-4 space-y-2.5 overflow-y-auto">
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="Full name *" value={newAddr.full_name} onChange={(e) => setNewAddr({ ...newAddr, full_name: e.target.value })} className="h-11 rounded-lg border-[#ECECEC]" />
                    <Input placeholder="Phone *" value={newAddr.phone} onChange={(e) => setNewAddr({ ...newAddr, phone: e.target.value })} inputMode="numeric" maxLength={10} className="h-11 rounded-lg border-[#ECECEC]" />
                  </div>
                  <Input placeholder="Flat, House no., Street, Area *" value={newAddr.street_address} onChange={(e) => setNewAddr({ ...newAddr, street_address: e.target.value })} className="h-11 rounded-lg border-[#ECECEC]" />
                  <div className="grid grid-cols-3 gap-2">
                    <Input placeholder="Pincode *" value={newAddr.pincode} onChange={(e) => setNewAddr({ ...newAddr, pincode: e.target.value.replace(/\D/g, "").slice(0, 6) })} inputMode="numeric" className="h-11 rounded-lg border-[#ECECEC]" />
                    <Input placeholder="City *" value={newAddr.city} onChange={(e) => setNewAddr({ ...newAddr, city: e.target.value })} className="h-11 rounded-lg border-[#ECECEC]" />
                    <Input placeholder="State *" value={newAddr.state} onChange={(e) => setNewAddr({ ...newAddr, state: e.target.value })} className="h-11 rounded-lg border-[#ECECEC]" />
                  </div>
                  <Input placeholder="Label (Home / Work)" value={newAddr.label} onChange={(e) => setNewAddr({ ...newAddr, label: e.target.value })} className="h-11 rounded-lg border-[#ECECEC]" />
                  <div className="flex gap-2 pt-1">
                    <Button className="flex-1 h-11 bg-black hover:bg-black/90" onClick={saveNewAddress}>Save address</Button>
                    <Button variant="outline" className="h-11" onClick={() => setShowAddAddress(false)}>Cancel</Button>
                  </div>
                </div>
              </>
            )}
          </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
