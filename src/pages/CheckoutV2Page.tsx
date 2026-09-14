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

import { useState, useEffect, useMemo, useRef, useCallback, lazy, Suspense, type MouseEvent } from "react";
import { useOutletContext, useSearchParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { supabaseStorefront } from "@/integrations/supabase/storefrontClient";
import { useCart } from "@/contexts/CartContext";
import { getPackagingOption } from "@/lib/packagingOptions";
import { useStorefrontAuth } from "@/contexts/StorefrontAuthContext";
import { formatPrice } from "@/lib/productUtils";
import { normalizePhone, isValidIndianPhone, toCanonicalIndianPhone } from "@/lib/phoneUtils";
import { storefrontPath } from "@/lib/subdomain";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import secureBadge from "@/assets/trust/secure-payment-badge.webp.asset.json";
import { Loader2, MapPin, ShieldCheck, CheckCircle2, ArrowLeft, Lock, Banknote, Tag, X, Plus, Minus, Check, CreditCard, ShoppingCart, ChevronDown, Trash2, Info, Camera, Package, Truck, Wallet, Sparkles, Headset } from "lucide-react";
import { toast } from "sonner";
import VoiceAddressButton, { type VoiceAddress } from "@/components/storefront/VoiceAddressButton";
import type { StoreData } from "@/layouts/StorefrontLayout";
import { fbPixelTrack, generateEventId } from "@/hooks/useFacebookPixel";
import { ga4Track } from "@/hooks/useGA4";
import { fireMetaCAPI, getMetaCookies } from "@/lib/metaCapi";
import { setCapiUser, getOrCreateSfVid, getCapiUser } from "@/lib/metaEnrichment";
import { getVisitorId, getOrCreateSessionId } from "@/lib/visitorSession";
import { fireStorefrontEvent } from "@/lib/storefrontEvents";
import { loadCashfree } from "@/lib/loadCashfree";
import { getOrCreateCheckoutToken, writeCheckoutTokenCookie, clearCheckoutTokenCookie, mintCheckoutToken } from "@/lib/checkoutTokenStore";
import { purchaseEventIdFor, firePixelPurchase, stagePendingPurchase, clearPendingPurchase } from "@/lib/pixelOutbox";
import { loadPayuBolt } from "@/lib/loadPayuBolt";
import { createPortal } from "react-dom";

const PostPurchaseUpsell = lazy(() => import("@/components/storefront/PostPurchaseUpsell"));
import { QRCodeSVG } from "qrcode.react";
import shopbanaoLogo from "@/assets/shopbanao-logo.webp";
import { useStorefrontThemeConfig } from "@/hooks/useStorefrontThemeConfig";
import { pixelPayloadFromItems } from "@/lib/expandBundleForPixel";
const CheckoutPhoneStep = lazy(() => import("@/components/storefront/CheckoutPhoneStep"));
// Loaded only after checkout is interactive — see `reviewsTeaserReady` below.
const CheckoutReviewsTeaser = lazy(() => import("@/components/storefront/checkout/CheckoutReviewsTeaser"));
import { estimateDelivery } from "@/lib/deliveryEstimate";
import CheckoutExitOffer from "@/components/storefront/CheckoutExitOffer";
import { useAutoFreeGiftLine } from "@/hooks/useAutoFreeGiftLine";
import CheckoutItemImage from "@/components/storefront/CheckoutItemImage";

type UpiApp = "gpay" | "phonepe" | "paytm" | "bhim" | "any";
type PayMethod = "upi" | "gateway" | "cod";

const isCompleteStreetAddress = (value: unknown): boolean =>
  String(value ?? "").trim().replace(/\s/g, "").length >= 10;

interface IntentState {
  status: "idle" | "loading" | "ready" | "failed";
  url?: string;
  error?: string;
  /** chargeAmount (in rupees) captured at intent creation. Used to detect
   *  stale intents when the shopper switches payment plan or coupon after
   *  the UPI URL was minted — prevents "chose Full but UPI opened for 100"
   *  race by refusing to launch a URL whose amount no longer matches. */
  amount?: number;
  /** Date.now() at mint. A UPI intent URL carries a gateway-side transaction
   *  reference (`tr`) that expires (Cashfree link ~15min, Razorpay S2S payment
   *  sooner). Launching an expired URL opens the UPI app on a transaction the
   *  bank will decline, so we re-mint instead. */
  at?: number;
}

/** Max age of a minted UPI intent before we force a fresh mint on tap. */
const UPI_INTENT_MAX_AGE_MS = 8 * 60 * 1000;


interface PendingOrder {
  id: string;
  number: string | null;
}

const UPI_APPS: { key: UpiApp; label: string; icon: string; deeplinkScheme: string }[] = [
  { key: "gpay", label: "G Pay", icon: "/icons/gpay-new.webp", deeplinkScheme: "tez://" },
  { key: "phonepe", label: "PhonePe", icon: "/icons/phonepe-new.webp", deeplinkScheme: "phonepe://" },
  { key: "paytm", label: "Paytm", icon: "/icons/paytm-round.webp", deeplinkScheme: "paytmmp://" },
  { key: "bhim", label: "BHIM", icon: "/icons/bhim.webp", deeplinkScheme: "bhim://" },
  { key: "any", label: "Any UPI app", icon: "/icons/upi.png", deeplinkScheme: "upi://" },
];

function isMobile(): boolean {
  if (typeof navigator === "undefined") return false;
  if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) return true;
  if (typeof window !== "undefined" && window.matchMedia?.("(max-width: 767px)").matches) return true;
  return false;
}

function isAndroid(): boolean {
  return typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);
}

/** iOS (incl. iPadOS 13+ which reports as Mac with touch points). */
function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) return true;
  return /Macintosh/i.test(navigator.userAgent) && (navigator as any).maxTouchPoints > 1;
}


const UPI_ANDROID_PACKAGES: Partial<Record<UpiApp, string>> = {
  gpay: "com.google.android.apps.nbu.paisa.user",
  phonepe: "com.phonepe.app",
  paytm: "net.one97.paytm",
};

/** Marker appended to the checkout URL when Chrome cannot resolve a package
 *  intent (app not installed). Fragment-only → same-document navigation, so
 *  checkout state survives and we can instantly show the UPI app chooser. */
const UPI_FALLBACK_HASH = "upi_fb";

function upiFallbackUrl(): string {
  // Chrome only honours S.browser_fallback_url when it is http(s). Pointing it
  // at the full checkout URL caused a hard reload whenever no app could handle
  // the intent — the shopper lost the page. Instead point it at the SAME url
  // with a `#upi_fb` fragment: Chrome accepts it as a legal https fallback but
  // performs a same-document navigation (no reload), and tapUpiApp listens for
  // the hashchange to react instantly.
  const base = typeof window !== "undefined"
    ? window.location.href.split("#")[0]
    : "https://shopbanao.in";
  return `${base}#${UPI_FALLBACK_HASH}`;
}

function androidIntentForUpi(query: string, packageName?: string): string {
  return (
    `intent://pay?${query}#Intent;scheme=upi;` +
    `action=android.intent.action.VIEW;` +
    `category=android.intent.category.BROWSABLE;` +
    (packageName ? `package=${packageName};` : "") +
    `S.browser_fallback_url=${encodeURIComponent(upiFallbackUrl())};end`
  );
}



function extractUpiQuery(url: string): string | null {
  const upi = url.match(/^upi:\/\/[^?]*\?([^#]+)/i);
  if (upi?.[1]) return upi[1];
  const intent = url.match(/^intent:\/\/(?:upi\/)?pay\?([^#]+)/i);
  if (intent?.[1]) return intent[1];
  const native = url.match(/^(?:tez:\/\/upi\/pay|phonepe:\/\/(?:upi\/)?pay|paytmmp:\/\/pay|bhim:\/\/pay)\?([^#]+)/i);
  return native?.[1] || null;
}


function genericUpiUrl(url: string): string | null {
  const query = extractUpiQuery(url);
  return query ? `upi://pay?${query}` : null;
}

/**
 * Launch a UPI/intent URL. Some Android Chrome + OEM WebView builds refuse
 * `location.assign()` for non-http schemes but honour a real anchor
 * activation, so click a synthetic <a> first and only fall back to
 * location.assign if that throws.
 */
/** Visible "order processing" beat before the UPI app takes over (ms).
 *  MUST stay 0. Android Chrome (and every in-app webview) only honours an
 *  external-scheme navigation while the tap's user-activation is still alive;
 *  the old 850ms beat pushed the hop outside that window on slower devices, so
 *  the FIRST tap silently did nothing and only the retry (fresh activation +
 *  already-minted intent) opened the app. The wait screen is armed before the
 *  hop anyway, so the shopper still sees the status UI. */
const UPI_LAUNCH_DELAY_MS = 0;
/** iOS: navigate in the SAME tick as the tap. Any timer — even 120ms — can
 *  push the custom-scheme navigation outside the "user activation" window in
 *  WKWebView (Instagram/WhatsApp in-app browsers are the strictest), and the
 *  tap silently does nothing. */
const UPI_LAUNCH_DELAY_IOS_MS = 0;

/** Coarse device tag for payment telemetry (iOS vs Android vs desktop, plus
 *  in-app webview), so UPI success/failure can actually be measured per OS. */
function deviceTag(): string {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent || "";
  const os = isIOS() ? "ios" : isAndroid() ? "android" : "desktop";
  let app = "browser";
  if (/Instagram/i.test(ua)) app = "instagram";
  else if (/FBAN|FBAV|FB_IAB/i.test(ua)) app = "facebook";
  else if (/WhatsApp/i.test(ua)) app = "whatsapp";
  else if (os === "ios" && !/Safari/i.test(ua)) app = "webview";
  return `${os}:${app}`;
}


function launchUpiUrl(url: string): void {
  // iOS: a synthetic anchor click for a non-http scheme is treated as a
  // programmatic popup by Safari and is frequently blocked. Direct location
  // assignment is the only path WKWebView + Safari both honour.
  if (isIOS()) {
    try { window.location.href = url; return; } catch { /* fall through */ }
  }
  try {
    const a = document.createElement("a");
    a.href = url;
    a.rel = "noopener";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    window.setTimeout(() => { try { a.remove(); } catch { /* noop */ } }, 0);
    return;
  } catch { /* fall through */ }
  try { window.location.assign(url); } catch {
    try { window.location.href = url; } catch { /* noop */ }
  }
}



/** Android apps that open DIRECTLY (no system "choose an app" sheet).
 *  Deliberately EMPTY: the merchant wants every tile (G Pay, PhonePe, Paytm,
 *  BHIM, "All UPI Apps") to hand a plain `upi://pay` intent to Android so the
 *  OS shows its own chooser listing only installed UPI apps — the same
 *  behaviour BHIM always had. Package-targeted intents silently no-op on
 *  OEM skins where the package id differs, so the chooser is also the safer
 *  path. Keep the array so the direct-open mechanism can be re-enabled by
 *  simply listing an app here. */
const UPI_DIRECT_OPEN_APPS: UpiApp[] = [];


/** Rewrite `upi://pay?...` to the safest app launch URL for the shopper's device. */
function schemeFor(app: UpiApp, url: string): string {
  if (!url) return url;
  const m = url.match(/^upi:\/\/[^?]*\?(.+)$/i);
  const query = m?.[1];
  if (!query) return url;

  if (isAndroid()) {
    // EVERY tile (including "Any UPI app") goes through a package-LESS
    // `intent://` URL. Android still shows its own chooser listing only the
    // UPI apps actually installed — the behaviour the merchant asked for — but
    // unlike a raw `upi://` link an intent URL is reliably handled by in-app
    // webviews (Instagram / Facebook / WhatsApp) AND carries a
    // browser_fallback_url, so "no UPI app on this phone" is detected within a
    // second instead of stranding the shopper on a 90s spinner.
    const packageName = UPI_DIRECT_OPEN_APPS.includes(app) ? UPI_ANDROID_PACKAGES[app] : undefined;
    return androidIntentForUpi(query, packageName);
  }

  if (app === "any") return url;



  // iOS has no UPI chooser — a plain upi:// link resolves to nothing (or to an
  // arbitrary app), so keep the app-specific universal schemes there. BHIM
  // registers `bhim://` on iOS; `upi://` used to dead-end for iPhone shoppers.
  // Google Pay registers `gpay://` on iOS. `tez://` is the legacy Android
  // scheme and silently no-ops in Safari/WKWebView on many current iPhones.
  if (app === "gpay") return `gpay://upi/pay?${query}`;
  if (app === "phonepe") return `phonepe://pay?${query}`;
  if (app === "paytm") return `paytmmp://pay?${query}`;
  if (app === "bhim") return isIOS() ? `bhim://upi/pay?${query}` : `upi://pay?${query}`;
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
    let settled = false;
    const finish = (loaded: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      resolve(loaded);
    };
    const timeoutId = window.setTimeout(() => {
      try { script.remove(); } catch { /* noop */ }
      finish(false);
    }, 12000);
    script.onload = () => finish(true);
    script.onerror = () => finish(false);
    document.body.appendChild(script);
  });
}

const SUPABASE_FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

async function callEdgeFunction(fnName: string, body: Record<string, any>, timeoutMs?: number) {
  const request = fetch(`${SUPABASE_FUNCTIONS_URL}/${fnName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify(body),
  });
  const res = timeoutMs
    ? await Promise.race([
        request,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`${fnName} timed out`)), timeoutMs),
        ),
      ])
    : await request;
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
  const themeConfig = useStorefrontThemeConfig(store?.id);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const qc = useQueryClient();
  const { items: cartItems, clearCart, removeFromCart, updateQuantity } = useCart();
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [breakupOpen, setBreakupOpen] = useState(false);
  // Buy-now single-mode quantity (cart mode uses CartContext quantities directly)
  const [buyNowQty, setBuyNowQty] = useState(() => {
    const q = Number(searchParams.get("qty") || 1);
    return Number.isFinite(q) ? Math.max(1, Math.min(99, Math.floor(q))) : 1;
  });
  const { customer, ensureCustomer } = useStorefrontAuth();
  const currency = store?.currency || "INR";
  const isHindi = store?.theme === "theme-16" || store?.theme === "theme-21";
  const tCritical = (en: string, hi: string) => (isHindi ? `${en} / ${hi}` : en);

  // ─── Buy-now (?product=&variant=) single-product mode ──────────────────
  const productId = searchParams.get("product");
  const variantId = searchParams.get("variant");
  const isRecoveryRetry = searchParams.get("recover") === "order";
  const isSingleMode = !!productId;
  // Packaging add-on carried over from the PDP buy-now link (?pkg=).
  const pkgOption = getPackagingOption(searchParams.get("pkg"));
  const pkgSurcharge = pkgOption.surcharge;

  // Anonymous shoppers have no direct SELECT grant on `products` /
  // `product_variants` (PostgREST returns 401). A cold buy-now checkout URL —
  // page refresh, WhatsApp recovery link, or a killed in-app WebView returning
  // to /checkout?product=... — therefore rendered an EMPTY ₹0 checkout and the
  // order could never be placed. Resolve the line item through a
  // security-definer RPC that works for anon instead.
  const { data: buyNowLine, isLoading: buyNowProductLoading } = useQuery({
    queryKey: ["checkoutv2-line", productId, variantId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_checkout_line_item", {
        _product_id: productId!,
        _variant_id: variantId || null,
      });
      if (error) throw error;
      return (data || {}) as { product?: any; variant?: any };
    },
    enabled: !!productId,
    staleTime: 10 * 60 * 1000,
    initialData: () => {
      if (!productId || variantId) return undefined; // variant price must come from the RPC
      const matches = qc.getQueriesData<any>({ queryKey: ["storefront-product", store?.id] });
      for (const [, p] of matches) if (p && p.id === productId) return { product: p, variant: null };
      return undefined;
    },
  });

  const buyNowProduct = buyNowLine?.product ?? null;
  const buyNowVariant = (buyNowLine?.variant ?? null) as
    | { id: string; name: string; price: number | null }
    | null;

  // Unified checkout items (buy-now OR cart). Includes variantId + image.
  const baseCheckoutItems = useMemo(() => {
    if (isSingleMode && buyNowProduct) {
      return [{
        productId: buyNowProduct.id as string,
        variantId: (buyNowVariant?.id as string | undefined),
        name: buyNowVariant ? `${buyNowProduct.name} (${buyNowVariant.name})` : buyNowProduct.name,
        price: ((buyNowVariant?.price ?? (buyNowProduct.sale_price && buyNowProduct.sale_price < buyNowProduct.price ? buyNowProduct.sale_price : buyNowProduct.price)) as number) + pkgSurcharge,
        quantity: buyNowQty,
        image: buyNowProduct.image_url as string | null,
        meta: (pkgSurcharge > 0
          ? { kind: "packaging", packaging: pkgOption.key, packaging_label: pkgOption.label, packaging_surcharge: pkgSurcharge }
          : null) as any,
      }];
    }
    return cartItems.map((i) => ({
      productId: i.productId,
      variantId: i.variantId,
      name: i.variantName ? `${i.name} (${i.variantName})` : i.name,
      price: i.price,
      quantity: i.quantity,
      image: (i as any).image || null,
      meta: (i as any).meta || null,
    }));
  }, [isSingleMode, buyNowProduct, buyNowVariant, buyNowQty, cartItems, pkgSurcharge, pkgOption.key, pkgOption.label]);

  // Free gift (Upsell app, cart_value trigger) — also for Buy Now checkouts,
  // which never pass through the cart where AutoFreeGift runs.
  const checkoutItems = useAutoFreeGiftLine(store?.slug, baseCheckoutItems as any) as typeof baseCheckoutItems;

  // Stable fingerprint of WHAT is being bought. Used by the recent-order guard
  // so it only blocks a re-mint of the *same* basket, never a genuinely new
  // order the shopper places minutes later.
  const cartSignature = useMemo(
    () =>
      checkoutItems
        .map((i) => `${i.productId}:${i.variantId || ""}:${i.quantity}`)
        .sort()
        .join("|"),
    [checkoutItems],
  );
  const cartSignatureRef = useRef(cartSignature);
  useEffect(() => { cartSignatureRef.current = cartSignature; }, [cartSignature]);

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
    // Auto-fill phone from logged-in session so returning shoppers skip
    // the phone gate entirely.
    if (customer?.phone && !toCanonicalIndianPhone(phone)) {
      const canon = toCanonicalIndianPhone(customer.phone) || String(customer.phone).replace(/\D/g, "").slice(-10);
      if (canon) setPhone(canon);
    }
    if (customer?.name && !fullName) setFullName(customer.name);
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
      const tryServerProxy = async () => {
        const r = await fetch(`${SUPABASE_FUNCTIONS_URL}/pincode-lookup?pincode=${pincode}`);
        if (!r.ok) throw new Error("proxy failed");
        const j = await r.json();
        if (!j?.ok) throw new Error("proxy no result");
        return { city: j.city as string, state: j.state as string };
      };
      try {
        // Owned edge fn first — avoids CORS / rate-limits on public APIs.
        let result: { city: string; state: string } | null = null;
        try { result = await tryServerProxy(); } catch { /* try public primary */ }
        if (!result) { try { result = await tryPrimary(); } catch { /* try public fallback */ } }
        if (!result) { try { result = await tryFallback(); } catch { /* silent */ } }
        if (cancelled || !result) return;
        // Always overwrite from a successful lookup so a stale value never blocks autofill
        if (result.city) setCity(result.city);
        if (result.state) setState(result.state);
      } finally { if (!cancelled) setPincodeLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [pincode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── "Use my current location" → browser GPS + reverse-geocode edge fn ───
  const [geoLoading, setGeoLoading] = useState(false);
  const handleUseMyLocation = useCallback(async () => {
    if (!("geolocation" in navigator)) {
      toast.error("Location not supported on this device");
      return;
    }
    setGeoLoading(true);
    try {
      // Two-stage fix: a fast coarse reading (cached ok) guarantees we always
      // have *something*, while a high-accuracy watch refines it. Resolve early
      // at <=50 m, otherwise take the best we have after 12 s.
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        let best: GeolocationPosition | null = null;
        let done = false;
        let watchId: number | null = null;
        let lastErr: any = null;
        const finish = (err?: any) => {
          if (done) return;
          done = true;
          if (watchId !== null) { try { navigator.geolocation.clearWatch(watchId); } catch {} }
          clearTimeout(timer);
          if (best) resolve(best);
          else reject(err || lastErr || { code: 3 });
        };
        const consider = (p: GeolocationPosition) => {
          if (!best || (p.coords.accuracy || 9999) < (best.coords.accuracy || 9999)) best = p;
          if ((p.coords.accuracy || 9999) <= 50) finish();
        };
        const timer = setTimeout(() => finish(), 12000);
        // Stage 1 — coarse/cached, usually instant
        navigator.geolocation.getCurrentPosition(
          consider,
          (e) => { lastErr = e; if (e?.code === 1) finish(e); },
          { enableHighAccuracy: false, timeout: 8000, maximumAge: 120000 },
        );
        // Stage 2 — precise GPS
        watchId = navigator.geolocation.watchPosition(
          consider,
          (e) => { lastErr = e; if (e?.code === 1) finish(e); },
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
        );
        // Once we have any fix, stop waiting the full 12 s — give GPS 4 more s
        const softStop = setInterval(() => {
          if (best && !done) { clearInterval(softStop); setTimeout(() => finish(), 4000); }
          if (done) clearInterval(softStop);
        }, 500);
      });

      const accuracy = position.coords.accuracy || 0;
      const { data, error } = await supabase.functions.invoke("reverse-geocode", {
        body: { lat: position.coords.latitude, lng: position.coords.longitude, accuracy },
      });
      if (error) throw error;
      const addr = data?.address;
      if (!data?.success || !addr) {
        toast.error("Couldn't detect your address — please type it");
        return;
      }
      if (addr.pincode) setPincode(String(addr.pincode).replace(/\D/g, "").slice(0, 6));
      if (addr.city) setCity(addr.city);
      if (addr.state) setState(addr.state);
      if (addr.street_address) setStreetAddress(addr.street_address);
      if (accuracy > 150) {
        toast.warning("Location not precise — please check/edit the address (सही पता जाँच लें)");
      } else {
        toast.success("Address auto-filled — please check it");
      }
    } catch (err: any) {
      if (err?.code === 1) toast.error("Location permission denied — allow it in browser settings");
      else if (err?.code === 3) toast.error("Location timed out — please type your address");
      else toast.error("Couldn't detect location");
    } finally {
      setGeoLoading(false);
    }
  }, []);




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

  const { data: paymentConfig, isFetched: paymentConfigFetched, isError: paymentConfigError, refetch: retryPaymentConfig } = useQuery({
    queryKey: ["store-payment-config", store?.id],
    queryFn: async () => {
      const request = supabase.rpc("get_store_payment_config", { _store_id: store.id });
      const timeout = new Promise<never>((_, reject) => {
        window.setTimeout(() => reject(new Error("Payment options took too long to load")), 10000);
      });
      const { data, error } = await Promise.race([request, timeout]);
      if (error) throw error;
      return data as {
        payment_methods: string[];
        razorpay_key_id: string | null;
        cashfree_app_id: string | null;
        cashfree_env: string | null;
        payu_merchant_key: string | null;
        payu_env: string | null;
        prepaid_discount_enabled?: boolean;
        prepaid_discount_type?: "fixed" | "percentage";
        prepaid_discount_value?: number;
        prepaid_discount_tier2_min?: number | null;
        prepaid_discount_tier2_value?: number | null;
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
  /** A store with no online gateway configured must still be orderable:
   *  fall back to Cash on Delivery so checkout never dead-ends. */
  const codAvailable = hasCod || (!hasOnline && paymentConfigLoaded);
  const activeGateway: "razorpay" | "cashfree" | "payu" | null =
    hasRazorpay ? "razorpay" : hasCashfree ? "cashfree" : hasPayu ? "payu" : null;
  const gatewayLabel = activeGateway === "razorpay" ? "Razorpay" : activeGateway === "cashfree" ? "Cashfree" : "PayU";

  /** HOSTED-GATEWAY MODE.
   *  Direct `upi://` intents are minted through a server-to-server API that most
   *  Cashfree / Razorpay merchant accounts are NOT approved for
   *  (`s2s_enabled_not_approved`). On those stores every UPI tile fails and the
   *  shopper dead-ends on an amber error panel — checkout is effectively broken
   *  unless PayU is configured. When we detect that, flip into hosted-gateway
   *  mode: the tiles keep their familiar look but hand off to the gateway's own
   *  UPI page (Cashfree drop-in), which every account can use. Sticky for the
   *  session per store+gateway so later taps skip the failing round-trip.
   *  Only PayU stores keep direct intents (their S2S mint is reliable); every
   *  other gateway goes hosted from the very first tap — no failed round-trip. */
  const gatewayOnlyKey = store?.id ? `sb_pgonly_${store.id}_${activeGateway || "none"}` : "";
  const nonPayuGateway = Boolean(activeGateway) && activeGateway !== "payu";
  const [gatewayOnlyFlag, setGatewayOnlyFlag] = useState(false);
  const gatewayOnly = nonPayuGateway || gatewayOnlyFlag;
  const gatewayOnlyRef = useRef(nonPayuGateway);
  useEffect(() => {
    let on = nonPayuGateway;
    try { if (gatewayOnlyKey && sessionStorage.getItem(gatewayOnlyKey) === "1") on = true; } catch { /* noop */ }
    gatewayOnlyRef.current = on;
    setGatewayOnlyFlag(on);
  }, [gatewayOnlyKey, nonPayuGateway]);
  const enableGatewayOnly = () => {
    if (gatewayOnlyRef.current) return;
    gatewayOnlyRef.current = true;
    setGatewayOnlyFlag(true);
    try { if (gatewayOnlyKey) sessionStorage.setItem(gatewayOnlyKey, "1"); } catch { /* noop */ }
  };


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
  const [addressSheetDismissed, setAddressSheetDismissed] = useState(false);
  const [newAddr, setNewAddr] = useState({ label: "Home", full_name: "", phone: "", street_address: "", apartment: "", city: "", state: "", pincode: "" });
  const [addrLabel, setAddrLabel] = useState<"Home" | "Work">("Home");
  const [apartment, setApartment] = useState("");
  const [addressAttempted, setAddressAttempted] = useState(false);


  const selectAddress = (addr: any) => {
    setSelectedAddressId(addr.id);
    setFullName(addr.full_name || "");
    setPhone(addr.phone || "");
    setStreetAddress(addr.street_address || "");
    setCity(addr.city || "");
    setState(addr.state || "");
    setPincode(addr.pincode || "");
    addressHydratedForPhoneRef.current =
      toCanonicalIndianPhone(addr.phone || "") || "";
  };

  // Tracks the canonical phone that the currently-displayed address was
  // hydrated for. When the shopper edits the phone to a different number
  // we clear the old address so we don't ship to the wrong person.
  const addressHydratedForPhoneRef = useRef<string>("");

  const applyPhoneLookupAddress = (addr: any) => {
    if (!isCompleteStreetAddress(addr?.street_address) || !addr?.pincode) return false;
    setSelectedAddressId(addr.id || null);
    setFullName(addr.full_name || "");
    const canonAddrPhone = toCanonicalIndianPhone(addr.phone) || addr.phone || phone;
    setPhone(canonAddrPhone);
    setStreetAddress(addr.street_address || "");
    setCity(addr.city || "");
    setState(addr.state || "");
    setPincode(String(addr.pincode || "").replace(/\D/g, "").slice(0, 6));
    addressHydratedForPhoneRef.current = toCanonicalIndianPhone(canonAddrPhone) || "";
    setReturningUsed(true);
    setReturningDismissed(true);
    setAddressSheetDismissed(true);
    setShowAddressFormSheet(false);
    return true;
  };

  // Voice → form. The pincode effect above re-derives city/state from the
  // official postal database right after this, so a misheard city self-corrects.
  const applyVoiceAddress = useCallback((a: VoiceAddress) => {
    if (a.full_name) setFullName(a.full_name);
    if (a.street) setStreetAddress(a.street);
    if (a.city) setCity(a.city);
    if (a.state) setState(a.state);
    if (/^\d{6}$/.test(a.pincode)) setPincode(a.pincode);
    // Never overwrite a phone the shopper already verified/entered.
    if (a.phone) setPhone((prev) => prev.trim() || a.phone);
  }, []);

  // When the shopper changes their phone number after an address was already
  // hydrated (either from a returning-order or a phone-lookup for a different
  // number), wipe the stale address so:
  //   1. we don't ship to the wrong person, and
  //   2. the phone→address lookup effect below re-runs for the new number.
  useEffect(() => {
    const canon = toCanonicalIndianPhone(phone);
    const hydrated = addressHydratedForPhoneRef.current;
    if (!hydrated) return;
    if (!canon || canon === hydrated) return;
    // Different number entered — clear the previous shopper's address.
    addressHydratedForPhoneRef.current = "";
    setSelectedAddressId(null);
    setFullName("");
    setStreetAddress("");
    setApartment("");
    setCity("");
    setState("");
    setPincode("");
    setAddressSheetDismissed(false);
    phoneAddressLookupRef.current = "";

    // Rotate the checkout idempotency token so place-order creates a fresh
    // pending row for the new shopper instead of UPDATE-in-place onto the
    // previous number's order (which would cross-attribute the lead).
    //
    // The previous token's pending row must be cancelled FIRST — otherwise it
    // is orphaned in `pending` forever (the rotated token can never update it
    // again), which is exactly how one shopper ends up owning two "pending"
    // orders minutes apart in the dashboard.
    const staleOrderId = orderIdRef.current ?? orderId;
    const staleToken = checkoutTokenRef.current;
    if (staleOrderId && staleToken && store?.id) {
      try {
        void supabase.functions
          .invoke("cancel-pending-order", {
            body: { store_id: store.id, order_id: staleOrderId, checkout_token: staleToken },
          })
          .catch(() => { /* swallow — non-critical cleanup */ });
      } catch { /* noop */ }
    }
    try {
      const fresh = mintCheckoutToken();
      setCheckoutToken(fresh);
    } catch { /* noop */ }
    // Reset any pending order state tied to the previous shopper.
    setPendingOrder(null);
    setOrderId(null);
    orderIdRef.current = null;
    orderSnapshotRef.current = null;
    // Allow the UPI intents to re-mint for the new shopper's order once
    // their address is filled (guard flag was one-shot per checkout).
    intentsMintedForAddressRef.current = false;

  }, [phone]);

  const phoneAddressLookupRef = useRef("");
  // Mirrors the live street address so async lookups can check it without
  // re-running the effect (and without clobbering what the shopper typed).
  const streetAddressRef = useRef("");
  useEffect(() => { streetAddressRef.current = streetAddress; }, [streetAddress]);
  // Tracks whether the async `create-guest-account` lookup for the current
  // phone has settled. While `pending`, we suppress auto-opening the address
  // sheet so returning shoppers (address on file) don't see a flash-of-form
  // that instantly disappears once the RPC hydrates their saved address.
  const [phoneLookupState, setPhoneLookupState] = useState<
    "idle" | "pending" | "done"
  >("idle");
  useEffect(() => {
    const canon = toCanonicalIndianPhone(phone);
    if (!store?.id || !canon) return;
    if (isCompleteStreetAddress(streetAddress) && pincode && city && state && fullName) return;
    const key = `${store.id}:${canon}`;
    if (phoneAddressLookupRef.current === key) return;
    phoneAddressLookupRef.current = key;

    let cancelled = false;
    setPhoneLookupState("pending");

    // ⚡ Two-track lookup so typing a phone never feels slow:
    //   track A (blocking, ~80-150ms): `address_only` read — decides whether
    //           to show the address form. Hard 900ms ceiling; if the network
    //           is slow we open the form instantly rather than making the
    //           shopper stare at a spinner.
    //   track B (background): the full create-guest-account call that mints
    //           the session + seeds customer_addresses. Never blocks the UI;
    //           if it finds an address later it still autofills.
    const settle = () => { if (!cancelled) setPhoneLookupState("done"); };
    const timer = window.setTimeout(settle, 600);

    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("create-guest-account", {
          body: { phone: canon, store_id: store.id, address_only: true },
        });
        if (cancelled || error) return;
        const addr = (data as any)?.address;
        if (addr) applyPhoneLookupAddress(addr);
      } catch {
        // Ignore — the shopper can still type a fresh address.
      } finally {
        window.clearTimeout(timer);
        settle();
      }
    })();

    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("create-guest-account", {
          body: { phone: canon, store_id: store.id },
        });
        if (cancelled || error) return;
        const result = data as {
          session?: { access_token?: string; refresh_token?: string } | null;
          address?: any;
        } | null;
        if (result?.session?.access_token && result?.session?.refresh_token) {
          await supabaseStorefront.auth.setSession({
            access_token: result.session.access_token,
            refresh_token: result.session.refresh_token,
          });
        }
        // Only autofill from the slow track if the shopper hasn't already
        // started typing their own address — never clobber live input.
        if (!cancelled && result?.address && !streetAddressRef.current) {
          applyPhoneLookupAddress(result.address);
        }
      } catch {
        // Keep checkout usable; session minting is best-effort.
      }
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store?.id, phone, streetAddress, pincode, city, state, fullName]);


  const openAddressFormSheet = () => {
    setShowAddressDialog(false);
    setShowAddAddress(false);
    setAddressSheetDismissed(false);
    setShowAddressFormSheet(true);
  };

  const closeAddressFormSheet = () => {
    // Stay on the checkout page — never navigate(-1) which pops back to the
    // PDP and breaks the flow. Just dismiss the sheet; user can reopen via
    // the "Add delivery address" CTA rendered when the address is missing.
    setShowAddressFormSheet(false);
    setAddressSheetDismissed(true);
  };

  const phoneValid = !!toCanonicalIndianPhone(phone);
  const addressComplete = !!(pincode && isCompleteStreetAddress(streetAddress) && city && state && fullName);
  // Ref mirror so async mint paths read the live value, never a stale closure.
  const addressCompleteRef = useRef(addressComplete);
  addressCompleteRef.current = addressComplete;
  // Live mirror of every address field. Deferred mint paths (coupon retry
  // timeout, 2.5s coalesce timer, config-change effects) capture an OLD
  // closure of validateAddress; reading state directly there produced a false
  // "Please enter your name" toast on a fully-filled form — 392 of 748 checkout
  // sessions hit it. validateAddress now reads these refs instead.
  const addrFieldsRef = useRef({ fullName, phone, pincode, streetAddress, city, state });
  addrFieldsRef.current = { fullName, phone, pincode, streetAddress, city, state };

  // Wait for the phone→address lookup to settle before deciding to show the
  // form. Prevents the flash-of-form for WhatsApp autologin shoppers whose
  // saved address arrives ~200-600ms after the checkout mounts.
  const addressLookupSettled = phoneLookupState !== "pending";
  const addressSheetOpen =
    showAddressFormSheet ||
    (phoneValid && addressLookupSettled && !addressComplete && !addressSheetDismissed);

  // PAYMENT-FIRST FLOW: We never auto-open the address sheet. The checkout
  // lands on payment tiles with a prominent red "+ Add delivery address" CTA.
  // The sheet only opens when the shopper explicitly taps the CTA, taps
  // "Change" on an existing address, or taps a payment tile (via
  // requireAddressOrPrompt, which also remembers the intent for auto-resume
  // after save). This matches Meesho/Gokwik and cut the address-form
  // drop-off that was inflating pending/cancelled orders on serdiyajewellers.


  // Pending pay-action: when the shopper taps a payment tile without an
  // address, we remember what they wanted so we can resume it the instant
  // they finish the address form.
  const pendingPayActionRef = useRef<null | (() => void)>(null);
  // One-shot bypass consumed by requireAddressOrPrompt after the shopper
  // saves the address sheet. Without this, the resumed tap handler still
  // holds a stale `addressComplete=false` closure and re-opens the sheet.
  const bypassAddressGateRef = useRef(false);

  /**
   * Address gate for every payment entry point (UPI intent tap, gateway
   * button, COD button). Returns `true` when the shopper can proceed; when
   * the address is missing it opens the sheet, stores the action for
   * auto-resume, and returns `false`.
   */
  const requireAddressOrPrompt = useCallback((resume?: () => void): boolean => {
    if (bypassAddressGateRef.current) {
      bypassAddressGateRef.current = false;
      return true;
    }
    if (addressComplete) return true;
    pendingPayActionRef.current = resume ?? null;
    setAddressSheetDismissed(false);
    setShowAddressFormSheet(true);
    toast.info("Add your delivery address to continue");
    return false;
  }, [addressComplete]);

  // Lock body scroll ONLY while an address overlay is actually rendered.
  // NOTE: `addressSheetOpen` is a *derived intent* flag (phone valid + address
  // missing) that stays true on the payment screen even though no sheet is
  // mounted — using it here froze the whole payment page's scroll.
  useEffect(() => {
    const anySheetOpen = showAddressFormSheet || showAddressDialog;
    if (!anySheetOpen) return;
    document.body.style.overflow = "hidden";
    // Always restore to the natural value — capturing the previous value can
    // permanently freeze the page when two overlays overlap (the second lock
    // records "hidden" as its "previous" state).
    return () => { document.body.style.overflow = ""; };
  }, [showAddressFormSheet, showAddressDialog]);


  // Safety net: never leave the page scroll-locked when checkout unmounts.
  useEffect(() => () => { document.body.style.overflow = ""; }, []);

  // Watchdog: if no overlay is open but the body is still locked (nested
  // overlays, an aborted animation, a Radix dialog that lost its cleanup),
  // unfreeze the page so shoppers can always scroll.
  useEffect(() => {
    if (showAddressFormSheet || showAddressDialog) return;
    const id = window.setInterval(() => {
      if (document.body.style.overflow === "hidden" && !document.querySelector("[data-radix-dialog-content],[data-sf-lock]")) {
        document.body.style.overflow = "";
      }
    }, 1200);
    return () => window.clearInterval(id);
  }, [showAddressFormSheet, showAddressDialog]);



  // ─── Keyboard-safe sheet height ────────────────────────────────────────
  // `dvh` does NOT shrink when the mobile keyboard opens on Android Chrome /
  // Instagram WebView, so the sheet stays 95% of the *full* screen and its
  // bottom (Continue button + last fields) ends up hidden behind the keyboard
  // with no way to scroll to it. Track visualViewport instead and drive the
  // sheet height from the real visible area.
  const addressSheetRef = useRef<HTMLDivElement | null>(null);
  const addressScrollRef = useRef<HTMLDivElement | null>(null);
  // Keyboard inset in px. Instagram / FB WebViews often do NOT shrink
  // visualViewport when the keyboard opens, so we fall back to a heuristic
  // inset while an input is focused — otherwise the lower fields sit behind
  // the keyboard with no way to scroll to them.
  const [kbInset, setKbInset] = useState(0);
  const inputFocusedRef = useRef(false);
  useEffect(() => {
    if (!showAddressFormSheet) return;
    const vv = (window as any).visualViewport as VisualViewport | undefined;
    const apply = () => {
      const el = addressSheetRef.current;
      if (!el) return;
      const h = vv?.height ?? window.innerHeight;
      const measured = vv ? Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)) : 0;
      el.style.height = `${Math.max(320, Math.round(h * 0.96))}px`;
      // Keep the sheet pinned to the visible viewport bottom when the browser
      // offsets the layout viewport (iOS Safari keyboard behaviour).
      el.style.transform = vv ? `translateY(-${measured}px)` : "";
      // Real inset when the browser reports it; heuristic otherwise.
      const shrink = vv ? Math.max(0, Math.round(window.innerHeight - vv.height)) : 0;
      setKbInset(shrink > 80 ? 0 : inputFocusedRef.current ? Math.round(window.innerHeight * 0.42) : 0);
    };
    apply();
    vv?.addEventListener("resize", apply);
    vv?.addEventListener("scroll", apply);
    window.addEventListener("resize", apply);
    return () => {
      vv?.removeEventListener("resize", apply);
      vv?.removeEventListener("scroll", apply);
      window.removeEventListener("resize", apply);
    };
  }, [showAddressFormSheet]);

  /**
   * Scroll a focused field into the *visible* band of the address scroller,
   * i.e. above the keyboard. Only scrolls when the field is actually out of
   * view, so Chrome no longer jumps the form on every field tap.
   */
  const ensureFieldVisible = useCallback((el: HTMLElement) => {
    const wrap = addressScrollRef.current;
    if (!wrap || !el) return;
    const wrapRect = wrap.getBoundingClientRect();
    const vv = (window as any).visualViewport as VisualViewport | undefined;
    const shrink = vv ? Math.max(0, Math.round(window.innerHeight - vv.height)) : 0;
    // Visible bottom = whichever is higher: the scroller bottom or the top of
    // the keyboard (real, or heuristic for Instagram WebView).
    const kb = shrink > 80 ? 0 : Math.round(window.innerHeight * 0.42);
    const visibleBottom = Math.min(wrapRect.bottom, (vv ? vv.height + (vv.offsetTop || 0) : window.innerHeight) - kb) - 12;
    const visibleTop = wrapRect.top + 8;
    const rect = el.getBoundingClientRect();
    if (rect.bottom <= visibleBottom && rect.top >= visibleTop) return; // already visible
    const delta = rect.bottom > visibleBottom ? rect.bottom - visibleBottom : rect.top - visibleTop;
    wrap.scrollBy({ top: delta, behavior: "smooth" });
  }, []);


  // Force Montserrat Alternates across the entire new checkout — including
  // early-return screens (order placed, waiting, phone step) and portaled
  // components (dialogs, toasts, sheets) that render outside the page root.
  useEffect(() => {
    const style = document.createElement("style");
    style.setAttribute("data-checkout-font", "v2");
    style.textContent = `
      body[data-checkout-v2="1"],
      body[data-checkout-v2="1"] *:not(i):not(svg):not([class*="lucide"]):not([data-checkout-marquee]):not([data-checkout-marquee] *) {
        font-family: 'Montserrat Alternates', system-ui, -apple-system, 'Segoe UI', sans-serif !important;
      }
      body[data-checkout-v2="1"] [data-checkout-marquee],
      body[data-checkout-v2="1"] [data-checkout-marquee] * {
        font-family: 'Alegreya SC', Georgia, serif !important;
      }
    `;
    document.head.appendChild(style);
    const prev = document.body.getAttribute("data-checkout-v2");
    document.body.setAttribute("data-checkout-v2", "1");
    return () => {
      style.remove();
      if (prev === null) document.body.removeAttribute("data-checkout-v2");
      else document.body.setAttribute("data-checkout-v2", prev);
    };
  }, []);

  useEffect(() => {
    if (savedAddresses && savedAddresses.length > 0 && !selectedAddressId) {
      // Only auto-pick a saved address when the phone in the input matches
      // the logged-in customer's phone. Otherwise the shopper just changed
      // the number to check out for someone else and we'd re-populate the
      // previous shopper's address (bug: cross-customer address leak).
      const canonInput = toCanonicalIndianPhone(phone);
      const canonCustomer = toCanonicalIndianPhone(customer?.phone || "");
      if (canonInput && canonCustomer && canonInput !== canonCustomer) return;
      const def = savedAddresses.find((a: any) => a.is_default) || savedAddresses[0];
      if (def) selectAddress(def);
    }
  }, [savedAddresses, phone, customer?.phone]); // eslint-disable-line react-hooks/exhaustive-deps

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
        // 1) Prefer an order in THIS store (most trusted — same brand/context).
        const { data: sameStore } = await supabase
          .from("orders")
          .select("id, customer_name, customer_phone, street_address, city, state, pincode, created_at")
          .eq("store_id", store.id)
          .eq("customer_phone", canon)
          .not("street_address", "is", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (cancelled) return;
        if (isCompleteStreetAddress(sameStore?.street_address) && sameStore?.pincode) {
          setReturningOrder(sameStore);
          return;
        }
        // 2) Cross-store fallback — customer typed same phone on ANY store.
        //    Their address is universal, so pre-fill from platform history.
        const { data: anyStore } = await supabase
          .from("orders")
          .select("id, customer_name, customer_phone, street_address, city, state, pincode, created_at")
          .eq("customer_phone", canon)
          .not("street_address", "is", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (cancelled) return;
        if (isCompleteStreetAddress(anyStore?.street_address) && anyStore?.pincode) setReturningOrder(anyStore);
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
    addressHydratedForPhoneRef.current = toCanonicalIndianPhone(phone) || "";
    toast.success("Welcome back! Address loaded ✨");
  };

  // Auto-apply returning-order address the moment it's found so a shopper
  // whose phone matches a prior order doesn't have to re-type anything.
  // Only fires when the current address is blank, so we never overwrite
  // something the shopper just typed.
  useEffect(() => {
    if (!returningOrder || returningUsed || returningDismissed) return;
    if (fullName || streetAddress || pincode) return;
    setFullName(returningOrder.customer_name || "");
    setStreetAddress(returningOrder.street_address || "");
    setCity(returningOrder.city || "");
    setState(returningOrder.state || "");
    setPincode(returningOrder.pincode || "");
    setReturningUsed(true);
    setAddressSheetDismissed(true);
    setShowAddressFormSheet(false);
    addressHydratedForPhoneRef.current = toCanonicalIndianPhone(phone) || "";
  }, [returningOrder, returningUsed, returningDismissed, fullName, streetAddress, pincode, phone]);


  // ─── Totals ─────────────────────────────────────────────────────────────
  const subtotal = useMemo(
    () => checkoutItems.reduce((s, i) => s + i.price * i.quantity, 0),
    [checkoutItems],
  );

  const shippingActive = shippingConfig?.is_active;
  const flatShippingRate = shippingActive ? Number(shippingConfig?.flat_rate) || 0 : 0;
  const freeShippingThreshold = shippingActive ? Number(shippingConfig?.free_shipping_above) || 0 : 0;

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
  const dismissedAutoCouponRef = useRef(false);
  const removeCoupon = () => {
    if (appliedCoupon?.auto_apply) dismissedAutoCouponRef.current = true;
    setAppliedCoupon(null); setCouponDiscount(0); setCouponCode(""); autoAppliedCouponRef.current = false;
  };

  // Store-owner configured auto-apply coupon (store-wide, shown on PDP too)
  const { data: autoApplyCoupon, isFetched: autoCouponFetched } = useQuery({
    queryKey: ["store-auto-apply-coupon", store?.id],
    enabled: !!store?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await (supabase as any).rpc("get_store_auto_apply_coupon", { _store_id: store.id });
      return Array.isArray(data) ? data[0] ?? null : data ?? null;
    },
  });

  // WhatsApp-exclusive auto coupon — only for shoppers who arrived from a
  // WhatsApp marketing/recovery message.
  const { data: waCoupon, isFetched: waCouponFetched } = useQuery({
    queryKey: ["store-wa-coupon", store?.id],
    enabled: !!store?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await (supabase as any).rpc("get_store_wa_coupon", { _store_id: store.id });
      return Array.isArray(data) ? data[0] ?? null : data ?? null;
    },
  });

  // The order/UPI amount must never be minted before we know whether an
  // auto-apply coupon exists — otherwise the shopper is charged the
  // undiscounted amount while the server books the discounted total.
  const couponsResolvedRef = useRef(false);
  const couponWaitTriesRef = useRef(0);
  couponsResolvedRef.current = !store?.id || (autoCouponFetched && waCouponFetched);


  useEffect(() => {
    if (autoAppliedCouponRef.current || appliedCoupon) return;
    if (!store?.id || subtotal <= 0) return;

    // Shoppers arriving via a WhatsApp marketing/recovery link (StorefrontAutoLogin
    // sets `sf_wa_source` when consuming the `?al=` token) get the store's
    // WhatsApp-exclusive coupon; everyone else gets the store-wide auto coupon.
    // Explicit ?coupon=... URL codes always win.
    const isWaSource = (() => {
      try {
        return sessionStorage.getItem("sf_wa_source") === "1"
          || localStorage.getItem("sf_wa_source") === "1";
      } catch { return false; }
    })();
    const waEligible = isWaSource && waCoupon?.code
      && Number(waCoupon.min_order_amount || 0) <= subtotal
      ? waCoupon : null;

    const picked = waEligible
      || (!dismissedAutoCouponRef.current && autoApplyCoupon ? autoApplyCoupon : null);
    const codeToApply = urlCoupon || picked?.code || null;
    if (!codeToApply) return;
    if (!urlCoupon && picked && Number(picked.min_order_amount || 0) > subtotal) return;
    autoAppliedCouponRef.current = true;
    applyCoupon(String(codeToApply).toUpperCase());
  }, [urlCoupon, store?.id, store?.slug, subtotal, appliedCoupon, autoApplyCoupon, waCoupon]); // eslint-disable-line react-hooks/exhaustive-deps


  // Re-validate the applied coupon when the cart total changes. If the shopper
  // removes items and drops below the coupon's minimum order value, or the
  // discount would exceed the new subtotal, recompute or drop it so the totals
  // stay in sync with what the backend will accept at place-order time.
  useEffect(() => {
    if (!appliedCoupon) return;
    const min = Number(appliedCoupon.min_order_amount || 0);
    if (subtotal <= 0 || subtotal < min) {
      setAppliedCoupon(null);
      setCouponDiscount(0);
      if (subtotal > 0) toast.info(`Coupon "${appliedCoupon.code}" removed — minimum order not met`);
      return;
    }
    let d = appliedCoupon.discount_type === "percentage"
      ? (subtotal * Number(appliedCoupon.discount_value)) / 100
      : Number(appliedCoupon.discount_value);
    d = Math.min(d, subtotal);
    if (d !== couponDiscount) setCouponDiscount(d);
  }, [subtotal, appliedCoupon]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Delivery-date promise (from pincode) ───────────────────────────────
  // Indian D2C shoppers convert on a *date*, not on "3–5 days".
  const deliveryEta = useMemo(() => estimateDelivery(pincode), [pincode]);



  // Shipping is calculated after coupon discount, matching the backend order
  // total. Otherwise a coupon can make the checkout display free shipping while
  // the gateway/order is minted with paid shipping (or vice versa).
  const shippingSubtotal = Math.max(0, subtotal - couponDiscount);
  const qualifiesForFreeShipping = shippingActive && freeShippingThreshold > 0 && shippingSubtotal >= freeShippingThreshold && flatShippingRate > 0;
  const shippingCharge = shippingActive ? (qualifiesForFreeShipping ? 0 : flatShippingRate) : 0;

  const total = Math.max(0, subtotal + (taxInclusive ? 0 : taxAmount) + shippingCharge - couponDiscount);

  // ─── Partial payment ────────────────────────────────────────────────────
  const partialEnabled: boolean = (store as any)?.partial_payment_enabled ?? false;
  const partialType: string = (store as any)?.partial_payment_type || "percentage";
  const partialValue: number | null = (store as any)?.partial_payment_value ?? null;
  // Strict rule: if the store has partial payment ON with a configured amount,
  // standalone full COD is never offered — regardless of gateway availability.
  const partialConfigured = partialEnabled && !!partialValue && Number(partialValue) > 0;
  const hasPartial = partialConfigured && hasOnline;

  const partialAdvanceTotal = useMemo(() => {
    if (!hasPartial) return total;
    // Advance is charged PER PRODUCT UNIT, exactly as the store owner
    // configured it (fixed ₹/unit or % of unit price) × quantity.
    let advance = 0;
    for (const it of checkoutItems) {
      const itemAdv = partialType === "percentage"
        ? Math.round(it.price * (Number(partialValue) / 100))
        : Math.min(Number(partialValue), it.price);
      advance += itemAdv * it.quantity;
    }
    // Coupons reduce the *balance* (paid on delivery), not the advance.
    // Shipping is charged up front; tax scales with the advance ratio.
    const ratio = subtotal > 0 ? advance / subtotal : 1;
    advance += (taxInclusive ? 0 : taxAmount) * ratio + shippingCharge;
    // Clamp to the order total LAST so the ₹50 floor can never exceed what the
    // cart is actually worth (a ₹5 item must never ask for a ₹50 advance).
    return Math.min(total, Math.max(50, Math.round(advance)));

  }, [checkoutItems, hasPartial, partialType, partialValue, subtotal, taxAmount, taxInclusive, shippingCharge, total]);

  const partialBalanceDue = Math.max(0, total - partialAdvanceTotal);

  const [payMode, setPayModeState] = useState<"full" | "partial">("partial");
  const isPartialOrder = hasPartial && payMode === "partial";
  const effectiveMode: "full" | "partial" = isPartialOrder ? "partial" : "full";
  // Wrap setPayMode so a user-driven Partial↔Full toggle always resets the
  // mint-loop guards. Otherwise a shopper who typed their address (7-8 mints)
  // and then switches payment plan sees the UPI tiles stuck on "Updating
  // amount…" forever — the snapshot changes, tiles flip to loading, but the
  // remint is silently blocked by the 8-mint cap.
  const setPayMode = (next: "full" | "partial") => {
    mintCountRef.current = 0;
    mintLoopBlockedRef.current = false;
    lastMintAtRef.current = 0;
    setPayModeState(next);
  };
  // ─── Prepaid discount (store setting) ──────────────────────────────────
  // Applied only on FULL online payment (not COD, not partial). Server
  // recomputes and stamps the same discount at place-order time so the
  // gateway is always charged what the tile advertised.
  // Preview discount ignoring current payMode — used to show "save ₹X" on the
  // Pay-Full option even while Partial is selected, so shoppers see the upside
  // of switching.
  const prepaidDiscountPreview = useMemo(() => {
    if (!paymentConfig?.prepaid_discount_enabled) return 0;
    if (total < 100) return 0;
    const baseVal = Number(paymentConfig.prepaid_discount_value || 0);
    if (baseVal <= 0 || total <= 0) return 0;
    // Tier-2: bigger flat discount above threshold (fixed-type only).
    const t2Min = Number(paymentConfig.prepaid_discount_tier2_min || 0);
    const t2Val = Number(paymentConfig.prepaid_discount_tier2_value || 0);
    const useTier2 = paymentConfig.prepaid_discount_type !== "percentage" && t2Min > 0 && t2Val > 0 && total >= t2Min;
    const flatVal = useTier2 ? t2Val : baseVal;
    const d = paymentConfig.prepaid_discount_type === "percentage" ? (total * baseVal) / 100 : flatVal;
    return Math.max(0, Math.min(Math.round(d), total));
  }, [paymentConfig, total]);
  const prepaidDiscount = isPartialOrder ? 0 : prepaidDiscountPreview;
  const prepaidTotalPreview = Math.max(0, total - prepaidDiscountPreview);
  const prepaidTotal = Math.max(0, total - prepaidDiscount);
  const chargeAmount = isPartialOrder ? partialAdvanceTotal : prepaidTotal;




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
  const orderIdRef = useRef<string | null>(null);
  const orderNumberRef = useRef<string | null>(null);
  /** paymentSnapshot value at the moment the current orderId was minted.
   *  Any later payment launch (UPI tap, Razorpay/Cashfree/PayU open, COD)
   *  compares this against the live paymentSnapshot: if they diverge, the
   *  order row is stale (plan/coupon/qty changed) and must be re-minted so
   *  the gateway is never called with the wrong charge amount. */
  const orderSnapshotRef = useRef<string | null>(null);
  useEffect(() => { orderIdRef.current = orderId; }, [orderId]);
  useEffect(() => { orderNumberRef.current = orderNumber; }, [orderNumber]);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const createOrderPromiseRef = useRef<Promise<void> | null>(null);
  const remintAfterCurrentOrderRef = useRef(false);
  // Set when an in-flight intent response is thrown away because the shopper
  // toggled Partial↔Full mid-request. Without this the UPI tiles could stay
  // stuck on "loading" forever (the finally-block's amountStillMatches check
  // can be true from an OLDER mint), which reads to the shopper as a dead
  // payment section — they leave with an order row and no gateway attempt.
  const discardedMintRef = useRef(false);

  // Throttle guards — prevent a feedback loop from hammering place-order.
  // Real cause seen in prod: chargeAmount recomputes fractionally out of sync
  // with the stamped intent amount (late paymentConfig, coupon reapply,
  // partial↔full toggle mid-flight), effect flags "stale", triggers re-mint,
  // new intents come back → still off by 1 paise → effect fires again → loop.
  // 437 place-order hits from a single IP in 10 min is a symptom of this.
  const lastMintAtRef = useRef<number>(0);
  // Amount of the last intent we successfully minted. Used to suppress a
  // redundant second mint: rapid triggers get coalesced into a deferred
  // re-mint, which used to run even when nothing about the amount changed —
  // burning a duplicate PayU UPI reference on every checkout.
  const lastMintedAmountRef = useRef<number | null>(null);
  const rateLimitRetryRef = useRef(false);
  const mintCountRef = useRef<number>(0);
  const mintLoopBlockedRef = useRef<boolean>(false);
  // Monotonic id for each UPI launch attempt. Timers/listeners from an older
  // tap must never act on a newer attempt (e.g. tap GPay → nothing opens → tap
  // PhonePe → GPay's "no app opened" timer would otherwise cancel the live
  // PhonePe wait). Also lets a new tap tear down the previous tap's listeners.
  const launchSeqRef = useRef(0);
  const launchCleanupRef = useRef<null | (() => void)>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const [pendingOrder, setPendingOrder] = useState<PendingOrder | null>(null);
  const [paymentFailed, setPaymentFailed] = useState(false);
  // IABB (Instagram/Facebook in-app browser) wipes sessionStorage when the
  // tab is backgrounded (user opens PhonePe/GPay and returns). Persist the
  // idempotency token in a cookie via shared util — see checkoutTokenStore.
  const [checkoutToken, setCheckoutToken] = useState<string>(() => getOrCreateCheckoutToken());
  const checkoutTokenRef = useRef(checkoutToken);
  useEffect(() => {
    checkoutTokenRef.current = checkoutToken;
    purchaseEventIdRef.current = purchaseEventIdFor(checkoutToken);
    writeCheckoutTokenCookie(checkoutToken);
  }, [checkoutToken]);


  // Set once an order on the current token is paid/placed. The next mint in
  // this same tab must start from a brand-new idempotency token.
  const tokenRetiredRef = useRef(false);


  const [intents, setIntents] = useState<Record<UpiApp, IntentState>>({
    gpay: { status: "idle" }, phonepe: { status: "idle" },
    paytm: { status: "idle" }, bhim: { status: "idle" }, any: { status: "idle" },
  });
  // Tap feedback for UPI tiles: which tile is currently "pressed / opening".
  // Purely presentational — never gates the launch itself.
  const [tappedUpiApp, setTappedUpiApp] = useState<UpiApp | null>(null);
  const tapFxTimerRef = useRef<number | null>(null);
  const flashUpiTap = (app: UpiApp, ms = 2600) => {
    try { (navigator as Navigator)?.vibrate?.(12); } catch { /* noop */ }
    setTappedUpiApp(app);
    if (tapFxTimerRef.current) window.clearTimeout(tapFxTimerRef.current);
    tapFxTimerRef.current = window.setTimeout(() => setTappedUpiApp(null), ms);
  };
  const clearUpiTapFx = () => {
    if (tapFxTimerRef.current) window.clearTimeout(tapFxTimerRef.current);
    tapFxTimerRef.current = null;
    setTappedUpiApp(null);
  };
  useEffect(() => () => { if (tapFxTimerRef.current) window.clearTimeout(tapFxTimerRef.current); }, []);

  /** ONE-TAP UPI: a tap that lands while the intent is still minting used to be
   *  a dead tap (silent return). Remember it instead and auto-launch the moment
   *  the intent turns ready. Expires so a stale tap can never launch later. */
  const pendingUpiTapRef = useRef<{ app: UpiApp; at: number } | null>(null);
  const tapUpiAppRef = useRef<((app: UpiApp, event?: any, opts?: { gesture?: boolean }) => void) | null>(null);
  // A queued tap must survive a full re-mint chain (place-order + PayU S2S can
  // take 3-10s, and an address/coupon change can chain two of them). 20s was
  // too short: the queued tap silently expired and the shopper's press was
  // thrown away.
  const PENDING_TAP_TTL_MS = 45000;



  const gatewayRef = useRef<{
    pg?: "cashfree" | "razorpay" | "payu";
    cf_order_id?: string;
    payu_txnid?: string;
    razorpay_payment_id?: string;
  }>({});
  // Deterministic Purchase event_id derived from the checkout token. A remount
  // (IABB tab wipe after the UPI hand-off, PayU redirect back, reload) reuses
  // the same token, so the browser Purchase and the server CAPI Purchase always
  // carry an identical event_id and Meta deduplicates them. Previously this was
  // regenerated per mount, so a remount produced a second, undedupable Purchase.
  const purchaseEventIdRef = useRef<string>(purchaseEventIdFor(checkoutTokenRef.current));
  const metaCookiesRef = useRef<{ fbc: string; fbp: string }>(getMetaCookies());
  // Debounced shipping-identity string. Address/name/phone changes must
  // still invalidate the snapshot (otherwise place-order's checkout_token
  // idempotency returns the original row and the edit is dropped — that's
  // the "1-letter street_address" bug). But feeding every keystroke into the
  // snapshot spawns a fresh cancelled order per ~2.5s of typing (throttled
  // remint loop), which is how a single shopper produced 8 pending/cancelled
  // orders in 15s. Debounce by 1.8s of idle typing so a burst collapses into
  // one mint at the end. Pricing/plan/items are NOT debounced — those must
  // invalidate instantly so the gateway is always charged the current amount.
  const shipIdentity = useMemo(() => [
    fullName.trim().toLowerCase(),
    normalizePhone(phone),
    streetAddress.trim().toLowerCase(),
    city.trim().toLowerCase(),
    state.trim().toLowerCase(),
    (pincode || "").replace(/\D/g, ""),
  ].join("|"), [fullName, phone, streetAddress, city, state, pincode]);
  // Pricing changes require a fresh gateway intent. Delivery-detail edits do
  // not: treating every address debounce as an amount change repeatedly tore
  // down otherwise-valid UPI intents and left the checkout faded/spinning.
  const paymentSnapshot = useMemo(() => JSON.stringify({
    mode: effectiveMode,
    total: Math.round(total * 100),
    charge: Math.round(chargeAmount * 100),
    coupon: appliedCoupon?.id || null,
    couponDiscount: Math.round(couponDiscount * 100),
    shipping: Math.round(shippingCharge * 100),
    items: checkoutItems.map((i) => [i.productId, i.variantId || "", i.quantity, Math.round(i.price * 100)]),
  }), [effectiveMode, total, chargeAmount, appliedCoupon?.id, couponDiscount, shippingCharge, checkoutItems]);

  // The order row still needs the latest delivery identity. This key is used
  // only when a real payment action creates/updates the row; it must not drive
  // payment-option loading state by itself.
  const orderDetailsSnapshot = useMemo(
    () => `${paymentSnapshot}|ship:${shipIdentity}`,
    [paymentSnapshot, shipIdentity],
  );

  const lastPaymentSnapshotRef = useRef(paymentSnapshot);
  const paymentAmountSyncing = (showPayment || !!orderId) && paymentSnapshot !== lastPaymentSnapshotRef.current;

  // ─── InitiateCheckout / AddPaymentInfo (fire at real intent only) ───────
  const initiateCheckoutFiredRef = useRef(false);
  const fireInitiateCheckoutOnce = () => {
    if (initiateCheckoutFiredRef.current) return;
    if (!store?.id || checkoutItems.length === 0) return;
    initiateCheckoutFiredRef.current = true;
    const eid = generateEventId();
    const eventData = {
      ...pixelPayloadFromItems(checkoutItems),
      value: total,
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
        currency, value: total,
        items: checkoutItems.map((i) => ({
          item_id: i.productId, item_name: i.name, item_variant: i.variantId, price: i.price, quantity: i.quantity,
        })),
      });
    } catch { /* noop */ }
  };

  // Fire InitiateCheckout once when checkout renders with a non-empty cart
  // (Meta expects IC:Purchase ~3-5:1; firing only on pay-tap under-reports the funnel).
  useEffect(() => {
    if (!store?.id) return;
    if (checkoutItems.length === 0) return;
    fireInitiateCheckoutOnce();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store?.id, checkoutItems.length]);

  const apiFiredRef = useRef<Set<string>>(new Set());
  const lastPaidMethodRef = useRef<string>("");
  const fireAddPaymentInfoOnce = (methodLabel: string, value: number) => {
    // Remember the method the user actually paid with so the Purchase pixel/CAPI
    // in onOrderSuccess can pick the right total (COD/partial → full order value,
    // full online → prepaid-discounted value).
    lastPaidMethodRef.current = methodLabel;
    if (!store?.id || checkoutItems.length === 0) return;
    if (apiFiredRef.current.has(methodLabel)) return;
    apiFiredRef.current.add(methodLabel);

    // FLUSH Advanced-Matching debounce: user may tap "Pay" <400ms after filling
    // the last address field. Sync setCapiUser here so `__SF_CAPI_USER__` has
    // full em/fn/ln/ct/st/zp/country BEFORE fireMetaCAPI reads the registry.
    try {
      const parts = (fullName || "").trim().split(/\s+/).filter(Boolean);
      setCapiUser({
        email: email.trim() || undefined,
        phone: normalizePhone(phone) || undefined,
        externalId: customer?.id || undefined,
        firstName: parts[0],
        lastName: parts.length > 1 ? parts.slice(1).join(" ") : undefined,
        city: city.trim() || undefined,
        state: state.trim() || undefined,
        zipCode: pincode.trim() || undefined,
      });
    } catch { /* noop */ }

    const eid = generateEventId();
    const data = {
      payment_method: methodLabel,
      ...pixelPayloadFromItems(checkoutItems),
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
    // Read from the live ref, not closed-over state — see addrFieldsRef.
    const f = addrFieldsRef.current;
    if (!f.fullName.trim()) return "Please enter your name";
    const nPhone = normalizePhone(f.phone);
    if (!isValidIndianPhone(nPhone)) return "Enter a valid 10-digit phone number";
    if (!/^\d{6}$/.test((f.pincode || "").replace(/\D/g, ""))) return "Enter a valid 6-digit pincode";
    if (!isCompleteStreetAddress(f.streetAddress)) return "Enter your complete address (house, area and landmark)";
    if (!f.city.trim()) return "Enter city";
    if (!f.state.trim()) return "Enter state";
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
            // Advanced Matching: same identifiers the browser Pixel sent, so
            // the server Purchase hashes match instead of minting a new person.
            external_id: (getCapiUser().externalId || getOrCreateSfVid() || undefined),
            email: (getCapiUser().email || undefined),
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

  /** Retire the current idempotency token and start a brand-new one. Called
   *  after a completed order, so the shopper's NEXT order (different product,
   *  same tab) never collides with the paid row keyed by the old token. */
  const rotateCheckoutToken = (): string => {
    const fresh = mintCheckoutToken();
    checkoutTokenRef.current = fresh;
    purchaseEventIdRef.current = purchaseEventIdFor(fresh);
    writeCheckoutTokenCookie(fresh);
    setCheckoutToken(fresh);
    tokenRetiredRef.current = false;
    return fresh;
  };

  const placeOrderRow = async (
    paymentMethodHint: string,
    paymentTypeOverride?: "full" | "partial",
    attempt = 0,
    userInitiated = false,
  ): Promise<PendingOrder> => {
    // Payment actions can resume from a callback captured before the address
    // sheet opened. Always read the live ref here; reading component-state from
    // that old closure submitted the first typed character (for example "7")
    // even though the shopper had completed the full address before continuing.
    const liveAddress = addrFieldsRef.current;
    const orderNotes = appliedCoupon
      ? `Coupon: ${appliedCoupon.code} (-${formatPrice(couponDiscount, currency)})`
      : undefined;
    // COD can never be partial — server rejects that combo. Force full so a
    // shopper who has "Pay ₹100 advance" pre-selected can still tap COD to
    // pay everything on delivery.
    const resolvedPaymentType: "full" | "partial" =
      paymentTypeOverride ?? (paymentMethodHint === "cod" ? "full" : effectiveMode);
    const placeOrderRequest = supabase.functions.invoke("place-order", {
      body: {
        store_id: store.id,
          checkout_token: checkoutTokenRef.current,
        order: {
          total, currency, status: "pending",
          customer_name: liveAddress.fullName.trim(),
          customer_phone: toCanonicalIndianPhone(liveAddress.phone) || normalizePhone(liveAddress.phone),
          customer_email: email.trim() || null,
          street_address: liveAddress.streetAddress.trim(),
          city: liveAddress.city.trim(), state: liveAddress.state.trim(), pincode: liveAddress.pincode.trim(),
          payment_method: paymentMethodHint,
          notes: orderNotes,
          storefront_customer_id: customer?.id ?? null,
          payment_type: resolvedPaymentType,
        },
        items: checkoutItems.map((it) => ({
          productId: it.productId,
          variantId: it.variantId,
          name: it.name, price: it.price, quantity: it.quantity,
          meta: (it as any).meta ?? undefined,
        })),
        coupon_id: appliedCoupon?.id ?? null,
        abandoned_cart_id: abandonedCartId ?? null,
        meta: buildPlaceOrderMeta(),
        visitor_id: (() => { try { return getVisitorId(); } catch { return null; } })(),
        session_id: (() => { try { return getOrCreateSessionId(); } catch { return null; } })(),
        attribution: buildAttribution(),
        user_initiated: userInitiated,
      },
    });
    // A cold or unhealthy payment function must never leave the whole checkout
    // disabled forever. Retrying is safe because checkout_token is idempotent.
    const { data, error } = await Promise.race([
      placeOrderRequest,
      new Promise<never>((_, reject) => window.setTimeout(
        () => reject(new Error("Payment preparation timed out. Please try again.")),
        20000,
      )),
    ]);
    if (error) throw new Error(error.message);
    const result = data as { order_id?: string; order_number?: string; error?: string; token_consumed?: boolean; token_stale?: boolean; already_paid?: boolean } | null;
    // The token in localStorage points at an abandoned attempt from an earlier
    // visit (>2h old, e.g. shopper came back the next day). Always rotate and
    // retry so today's payment creates TODAY's order instead of reviving the
    // old row with its old timestamp.
    if (result?.token_stale && attempt === 0) {
      rotateCheckoutToken();
      return placeOrderRow(paymentMethodHint, paymentTypeOverride, 1, userInitiated);
    }
    // Server backstop: this shopper already has a paid order from this session
    // and the request was an automatic re-mint. Do not surface an error, and do
    // not treat it as a new order — just stop.
    if (result?.already_paid && !userInitiated) {
      throw new Error("checkout_already_completed");
    }

    // The token this tab is holding already belongs to a PAID/confirmed order.
    // Two very different situations produce this:
    //  (a) the shopper genuinely started a SECOND checkout in the same tab
    //      (success screen → browsed another product → tapped Buy). Here we must
    //      rotate to a fresh idempotency key and place the new order for real.
    //  (b) a stale AUTOMATIC re-mint fired right after payment succeeded. Here
    //      rotating would silently create the duplicate "Pending" row we saw
    //      1–2 minutes after every partially-paid order. Abort instead.
    if (result?.token_consumed && attempt === 0) {
      if (!userInitiated || orderPlacedRef.current) {
        throw new Error("checkout_already_completed");
      }
      rotateCheckoutToken();
      return placeOrderRow(paymentMethodHint, paymentTypeOverride, 1, true);
    }
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
        label: addrLabel || "Home",
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

  // Purchase value semantics for pixels/CAPI: the total order value committed
  // to (matches what place-order writes to the DB `orders.total`), NOT the
  // amount charged now.
  //   • Full online paid  → prepaidTotal (discount applied, server recomputes to this)
  //   • Partial (COD+adv) → full `total` (advance is only what's charged now)
  //   • COD               → full `total` (no prepaid discount for COD)
  // chargeAmount alone is wrong for partial (undercounts) and for COD when a
  // prepaid discount is configured (undercounts by the discount amount).
  const computePurchaseValue = (method: string): number => {
    const m = (method || "").toLowerCase();
    if (m === "cod" || m.startsWith("partial_cod")) return total;
    if (isPartialOrder) return total;
    return prepaidTotal;
  };

  const onOrderSuccess = (ordId: string) => {
    if (finalizedOrderIdsRef.current.has(ordId)) return;
    finalizedOrderIdsRef.current.add(ordId);

    try { sessionStorage.removeItem("pending_coupon"); localStorage.removeItem("pending_coupon"); } catch { /* noop */ }
    try { localStorage.removeItem("checkout_phone"); } catch { /* noop */ }
    try { sessionStorage.removeItem(`ac_${store.id}`); } catch { /* noop */ }
    saveExpressInfo();

    if (!isSingleMode) {
      clearCart();
    } else {
      // Buy-Now: the ordered product may also be sitting in the cart — drop it
      // so the shopper never sees an already-purchased item again.
      try {
        checkoutItems.forEach((ci) => removeFromCart(ci.productId, ci.variantId));
      } catch { /* noop */ }
    }
    // Buy-Now guard: mark this product+variant as "just ordered" so if the
    // shopper hits back after the success screen we don't drop them into the
    // same checkout again with the same URL params. Also fold the ordered
    // productIds into a session set so cart-mode back-navigation with a
    // stale ?product= param (or a reloaded checkout URL) is protected too.
    try {
      const pid = checkoutItems[0]?.productId;
      const vid = checkoutItems[0]?.variantId;
      if (pid) {
        const key = `recent_order:${store.id}:${pid}${vid ? `:${vid}` : ""}`;
        sessionStorage.setItem(key, ordId);
      }
      // Cross-mount / IABB-safe guard: sessionStorage is wiped when Instagram/
      // FB webviews background the tab (UPI redirect). Duplicate-order incidents
      // (#2782→#2783, #2786→#2787) traced to a stale "partial" mint firing 5-70s
      // AFTER a "full" order confirmed, same session_id + product. localStorage
      // survives the IABB wipe, so any re-entry into createOrderIfNeeded within
      // 3 minutes for this store is short-circuited.
      const guardPayload = JSON.stringify({ ordId, at: Date.now(), sig: cartSignatureRef.current });
      localStorage.setItem(`sb_last_order:${store.id}`, guardPayload);
    } catch { /* noop */ }
    window.dispatchEvent(new CustomEvent("order-placed"));



    const purchaseValue = computePurchaseValue(lastPaidMethodRef.current);

    // Pixel Purchase — deduped in localStorage (survives the Instagram/FB
    // in-app-browser sessionStorage wipe that used to let a remount fire a
    // second Purchase) and force-loads fbevents.js so the event isn't stranded
    // in the fbq shim queue when the shopper closes the tab.
    firePixelPurchase({
      orderId: ordId,
      eventId: purchaseEventIdRef.current,
      value: purchaseValue,
      currency,
      payload: {
        ...pixelPayloadFromItems(checkoutItems),
        content_name: checkoutItems.map((i) => i.name).join(", "),
        order_id: ordId,
      },
    });
    clearPendingPurchase(ordId);


    try {
      ga4Track("purchase", {
        transaction_id: ordId, value: purchaseValue, currency,
        items: checkoutItems.map((i) => ({
          item_id: i.productId, item_name: i.name, item_variant: i.variantId, price: i.price, quantity: i.quantity,
        })),
      });
    } catch { /* noop */ }

    try {
      fireStorefrontEvent({
        storeId: store.id, eventName: "purchase",
        value: purchaseValue, currency,
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
  // Short "processing" beat shown between the UPI tile tap and the app handoff.
  
  const [manualChecking, setManualChecking] = useState(false);
  const waitingCheckInFlightRef = useRef(false);
  // Absolute wall-clock start of the CURRENT payment wait. Survives remounts
  // (restored from the persisted WAIT_KEY.ts) so a shopper who cancels in the
  // UPI app and wanders back into checkout can never restart a fresh polling
  // budget over and over — that's what made "processing" look infinite.
  const waitStartedAtRef = useRef(0);
  // True when the wait was restored from storage (i.e. the shopper is already
  // back on our page after the payment app), so the poller treats it as a
  // "returned from app" wait and exits fast with a retry option.
  const waitResumedRef = useRef(false);

  // Set later by the exit-intent block; lets the header back arrow open the save sheet.
  const exitTriggerRef = useRef<null | ((explicit?: boolean) => boolean)>(null);

  const goBack = useCallback(() => {
    // Gokwik-style: intercept the FIRST leave attempt from the header arrow,
    // including while the phone/address sheet is open.
    if (exitTriggerRef.current?.(true)) return;
    if (showAddressFormSheet && addressComplete) {
      closeAddressFormSheet();
      return;
    }
    if (showPayment && !waiting && !confirmingPayment) {
      setShowPayment(false);
      return;
    }
    navigate(storefrontPath(store?.slug || ""), { replace: true });
  }, [addressComplete, confirmingPayment, navigate, showAddressFormSheet, showPayment, store?.slug, waiting]);



  const WAIT_KEY = `sf_wait_v2_${store?.id}`;
  const persistWaiting = (app: UpiApp, label: string, override?: { orderId?: string | null; orderNumber?: string | null }) => {
    const waitOrderId = override?.orderId ?? orderId;
    if (!waitStartedAtRef.current) waitStartedAtRef.current = Date.now();
    waitResumedRef.current = false;
    try {
      const payload = JSON.stringify({
        orderId: waitOrderId,
        orderNumber: override?.orderNumber ?? orderNumber,
        app, label, gateway: gatewayRef.current, ts: Date.now(),
      });
      sessionStorage.setItem(WAIT_KEY, payload);
      localStorage.setItem(WAIT_KEY, payload);
    } catch { /* noop */ }
    // Durable Purchase outbox: the shopper is leaving for a UPI app / gateway
    // page. If the tab never comes back (very common on Android UPI hand-offs)
    // the browser Purchase would be lost entirely. Stage it now — the next
    // storefront pageload verifies the order status and fires the pixel then,
    // with the SAME event_id the server already stored, so nothing double-counts.
    if (waitOrderId && store?.id) {
      try {
        stagePendingPurchase({
          storeId: store.id,
          orderId: waitOrderId,
          eventId: purchaseEventIdRef.current,
          value: computePurchaseValue(lastPaidMethodRef.current),
          currency,
          payload: {
            ...pixelPayloadFromItems(checkoutItems),
            content_name: checkoutItems.map((i) => i.name).join(", "),
            order_id: waitOrderId,
          },
          // Match keys snapshot so a replayed Purchase (tab died during the
          // UPI hand-off) still carries phone/name/city/state/pincode.
          user: Object.fromEntries(
            Object.entries({
              email: email.trim(),
              phone: toCanonicalIndianPhone(phone) || normalizePhone(phone),
              firstName: (fullName || "").trim().split(/\s+/)[0] || "",
              lastName: (fullName || "").trim().split(/\s+/).slice(1).join(" "),
              city: city.trim(),
              state: state.trim(),
              zipCode: pincode.trim(),
            }).filter(([, v]) => !!v),
          ) as Record<string, string>,
          at: Date.now(),
        });
      } catch { /* noop */ }
    }
  };
  const clearWaiting = () => {
    waitStartedAtRef.current = 0;
    waitResumedRef.current = false;
    try { sessionStorage.removeItem(WAIT_KEY); } catch { /* noop */ }
    try { localStorage.removeItem(WAIT_KEY); } catch { /* noop */ }
  };

  const normalizeGatewayResult = (payload: any): "success" | "failed" | "pending" => {
    const raw = String(payload?.status || payload?.payment_status || payload?.order_status || "").toLowerCase();
    if (payload?.success === true || ["paid", "success", "captured", "authorized"].includes(raw)) return "success";
    // PayU/Cashfree/Razorpay status APIs return a definitive FAILED verdict when
    // the shopper cancelled inside the UPI app or the gateway dropped the txn.
    // Surface that immediately instead of polling for 90s — matches the old
    // checkout's "instant cancel" UX.
    if (["failed", "failure", "cancelled", "canceled", "usercancelled", "user_cancelled", "dropped", "bounced", "expired", "timeout"].includes(raw)) return "failed";
    return "pending";
  };

  const forceGatewayVerify = async () => {
    if (!orderId) return null;
    const gw = gatewayRef.current;
    // Mobile WebViews can suspend an in-flight fetch while the UPI app is open
    // and never settle it after returning. Without a bound, checkNow keeps the
    // global in-flight lock forever and every focus/pageshow recheck is skipped,
    // leaving a paid shopper on "processing" indefinitely.
    const invokeWithTimeout = async (name: string, body: Record<string, unknown>, timeoutMs = 10000) => {
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      try {
        return await Promise.race([
          supabase.functions.invoke(name, { body }),
          new Promise<never>((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error(`${name} timed out`)), timeoutMs);
          }),
        ]);
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }
    };
    try {
      if (gw.pg === "cashfree" && gw.cf_order_id) {
        const { data } = await invokeWithTimeout("store-cashfree-status", {
          store_id: store.id, order_id: orderId, cf_order_id: gw.cf_order_id,
        });
        return data;
      }
      if (gw.pg === "razorpay") {
        const { data } = await invokeWithTimeout("razorpay-payment-status", {
          store_id: store.id, order_id: orderId, razorpay_payment_id: gw.razorpay_payment_id,
        });
        return data;
      }
      if (gw.pg === "payu") {
        const { data } = await invokeWithTimeout("payu-status", {
          store_id: store.id, order_id: orderId, txnid: gw.payu_txnid,
        });
        return data;
      }
    } catch { /* noop */ }
    return null;
  };

  const [orderPlaced, setOrderPlaced] = useState(false);
  /** Synchronous mirror of `orderPlaced`. React state updates are async, so a
   *  mint that was already scheduled (coalesce timer / queueMicrotask / in-flight
   *  promise) could still run AFTER payment succeeded, hit `token_consumed`,
   *  rotate the token and create a duplicate pending order. This ref lets every
   *  automatic path bail out the instant the payment is confirmed. */
  const orderPlacedRef = useRef(false);

  // ─── Exit-intent save sheet ─────────────────────────────────────────────
  // Opens only after a deliberate leave attempt: the checkout header back
  // arrow or browser/mobile back. Never interrupt a shopper because they are
  // reading reviews, comparing payment methods, or spending longer on checkout.
  // Offers the store's WhatsApp-exclusive coupon (bigger than the store-wide
  // auto coupon) which replaces the currently applied one on claim.
  const [exitOfferOpen, setExitOfferOpen] = useState(false);
  const exitGuardPushedRef = useRef(false);

  const exitCoupon = useMemo(() => {
    if (!waCoupon?.code || subtotal <= 0) return null;
    if (Number(waCoupon.min_order_amount || 0) > subtotal) return null;
    if (appliedCoupon?.code && String(appliedCoupon.code).toUpperCase() === String(waCoupon.code).toUpperCase()) return null;
    const raw = waCoupon.discount_type === "percentage"
      ? (subtotal * Number(waCoupon.discount_value)) / 100
      : Number(waCoupon.discount_value);
    const value = Math.min(Math.round(raw), subtotal);
    if (value <= couponDiscount) return null;
    return { code: String(waCoupon.code).toUpperCase(), value };
  }, [waCoupon, subtotal, appliedCoupon, couponDiscount]);

  const exitExtraSaving = exitCoupon ? Math.max(0, exitCoupon.value - couponDiscount) : 0;

  // Gokwik-style: the sheet fires on ANY abandon attempt with items in cart,
  // with or without a coupon (no-coupon variant is a reassurance sheet).
  const canShowExitOffer =
    !!store?.id &&
    checkoutItems.length > 0 &&
    !orderPlaced &&
    !waiting &&
    !confirmingPayment &&
    !creatingOrder;
  // Explicit header/browser back must not be blocked by background order or
  // intent preparation. That work commonly runs for a few seconds immediately
  // after phone entry, which made the visible back arrow appear broken. Only
  // an actual payment wait/confirmation or completed order suppresses it.
  const canShowExplicitExitOffer =
    !!store?.id &&
    checkoutItems.length > 0 &&
    !orderPlaced &&
    !waiting &&
    !confirmingPayment;
  const canShowExplicitExitOfferRef = useRef(canShowExplicitExitOffer);
  canShowExplicitExitOfferRef.current = canShowExplicitExitOffer;

  const triggerExitOffer = useCallback((_explicit = false) => {
    if (!canShowExplicitExitOfferRef.current) return false;
    setExitOfferOpen(true);
    return true;
  }, []);

  // Expose to handlers declared earlier in the component (e.g. the header back arrow).
  exitTriggerRef.current = triggerExitOffer;

  // Back-press guard (mobile). Two separate concerns so the listener can never
  // be torn down by a state flip while the guard entry stays on the stack:
  //   1. push one sentinel history entry once checkout is interactive
  //   2. keep a permanently-mounted popstate listener that consumes it
  useEffect(() => {
    if (!canShowExitOffer || exitGuardPushedRef.current) return;
    exitGuardPushedRef.current = true;
    try { window.history.pushState({ sfExitGuard: true }, ""); } catch { /* noop */ }
  }, [canShowExitOffer]);

  useEffect(() => {
    const onPop = () => {
      if (!exitGuardPushedRef.current) return;
      if (triggerExitOffer(true)) {
        // Re-arm so the sheet's own "go back" is what actually leaves.
        try { window.history.pushState({ sfExitGuard: true }, ""); } catch { /* noop */ }
      } else {
        exitGuardPushedRef.current = false;
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [triggerExitOffer]);

  const claimExitOffer = async () => {
    setExitOfferOpen(false);
    if (exitCoupon) {
      dismissedAutoCouponRef.current = true;
      autoAppliedCouponRef.current = true;
      // Remember the claim so the phone/address step advertises the claimed
      // (bigger) coupon instead of the store-wide auto one.
      try { sessionStorage.setItem(`sf_exit_claimed_${store?.id || "x"}`, exitCoupon.code); } catch { /* noop */ }
      await applyCoupon(exitCoupon.code);
    }
    if (!showPayment) setShowPayment(true);
    try { window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }); } catch { /* noop */ }
  };

  const leaveFromExitOffer = () => {
    setExitOfferOpen(false);
    exitGuardPushedRef.current = false;
    navigate(storefrontPath(store?.slug || ""), { replace: true });
  };

  const exitOfferDialog = (
    <CheckoutExitOffer
      open={exitOfferOpen}
      offerLabel={exitCoupon ? `${formatPrice(exitCoupon.value, currency)} OFF` : couponDiscount > 0 ? `${formatPrice(couponDiscount, currency)} OFF` : undefined}
      offerCode={exitCoupon?.code || appliedCoupon?.code}
      currentTotalLabel={exitExtraSaving > 0 ? formatPrice(total, currency) : undefined}
      newTotalLabel={exitExtraSaving > 0 ? formatPrice(Math.max(0, total - exitExtraSaving), currency) : formatPrice(total, currency)}
      alreadyClaimed={!exitCoupon}
      onClaim={() => { void claimExitOffer(); }}
      onLeave={leaveFromExitOffer}
      onClose={() => setExitOfferOpen(false)}
    />
  );


  const [viewingOrders, setViewingOrders] = useState(false);
  const [showUpsell, setShowUpsell] = useState(false);
  const [advancePaid, setAdvancePaid] = useState(0);
  const [balanceDue, setBalanceDue] = useState(0);

  // Review teaser is mounted only once the browser is idle, so the review
  // chunk + RPC never compete with checkout's critical path.
  const [reviewsTeaserReady, setReviewsTeaserReady] = useState(false);
  useEffect(() => {
    if (reviewsTeaserReady) return;
    const w = window as any;
    const id = w.requestIdleCallback
      ? w.requestIdleCallback(() => setReviewsTeaserReady(true), { timeout: 4000 })
      : window.setTimeout(() => setReviewsTeaserReady(true), 2500);
    return () => {
      if (w.cancelIdleCallback) w.cancelIdleCallback(id);
      else clearTimeout(id);
    };
  }, [reviewsTeaserReady]);

  const finishSuccess = (paidOrderId?: string | null) => {
    const finalOrderId = paidOrderId || orderId;
    if (!finalOrderId) return;
    // Freeze every automatic order-minting path SYNCHRONOUSLY. Any deferred
    // re-mint (2.5s coalesce timer, queued microtask, in-flight promise) that
    // lands after this point must not create a second order row.
    orderPlacedRef.current = true;
    remintAfterCurrentOrderRef.current = false;
    clearWaiting();
    try {
      sessionStorage.removeItem(`payu_pending_${store.id}`);
      localStorage.removeItem(`payu_pending_${store.id}`);
    } catch { /* noop */ }
    // Commit the paid UI state BEFORE cart/account/analytics side effects.
    // A blocked Pixel script, storage exception, or cart subscriber must never
    // be able to strand a verified-paid shopper on the processing screen.
    if (!orderId) setOrderId(finalOrderId);
    setWaiting(false);
    setConfirmingPayment(false);
    setPaymentFailed(false);
    setPendingOrder(null);
    setOrderPlaced(true);
    setShowUpsell(true);
    // Order is paid — retire the checkout_token so the next checkout starts
    // with a fresh idempotency key (IABB cookie fix).
    clearCheckoutTokenCookie();
    tokenRetiredRef.current = true;
    try { window.scrollTo({ top: 0, behavior: "auto" }); } catch { /* noop */ }
    try {
      onOrderSuccess(finalOrderId);
    } catch (err) {
      // Payment confirmation is authoritative; post-purchase telemetry is
      // best-effort and must not roll back or block the confirmation screen.
      console.error("Post-purchase side effect failed:", err);
    }
  };


  /**
   * A UPI intent URL is single-use at the gateway: it carries a transaction
   * reference (`tr`) plus, for Razorpay/Cashfree, an already-created payment
   * attempt. Once an attempt ends WITHOUT success (shopper cancelled in GPay,
   * bank declined, timeout), re-launching the very same URL makes the UPI app
   * either refuse it as a duplicate transaction or open a payment that can
   * never be captured — the classic "I keep tapping GPay and it always fails"
   * loop. Drop the intents back to `idle` so the next tap mints a fresh one,
   * and clear the mint throttle so that mint is actually allowed to run.
   */
  const invalidateUpiIntents = () => {
    mintCountRef.current = 0;
    mintLoopBlockedRef.current = false;
    lastMintAtRef.current = 0;
    lastMintedAmountRef.current = null;
    const apps: UpiApp[] = ["gpay", "phonepe", "paytm", "bhim", "any"];
    setIntents((s) => {
      const next = { ...s };
      apps.forEach((a) => { next[a] = { status: "idle" }; });
      return next;
    });
  };

  const stopWaitingForPayment = (message?: string) => {
    clearWaiting();
    setWaiting(false);
    setConfirmingPayment(false);
    if (orderId) setPendingOrder({ id: orderId, number: orderNumber });
    setPaymentFailed(true);
    invalidateUpiIntents();
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
      if (existing?.session?.user) { navigate(orderPath, { replace: true }); return; }
      if (guestAccountPromiseRef.current) {
        await Promise.race([
          guestAccountPromiseRef.current.catch(() => {}),
          new Promise((r) => setTimeout(r, 600)),
        ]);
        const { data: after } = await supabaseStorefront.auth.getSession();
        if (after?.session?.user) { navigate(orderPath, { replace: true }); return; }
      }
      const normalized = toCanonicalIndianPhone(phone) || normalizePhone(phone);
      if (!normalized || normalized.length < 10) { navigate(orderPath, { replace: true }); return; }
      navigate(orderPath, { replace: true });
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
    // Desktop UPI QR needs a long window — shopper opens their phone, scans,
    // then approves in the UPI app. Full-modal gateways (Razorpay/PayU/Cashfree)
    // resolve much faster because we come back via redirect.
    const isDesktopQr = !isMobile() && waitingApp === "UPI QR";
    // Gateway redirect returns (PayU/Cashfree/Razorpay): PayU's verify_payment API
    // frequently lags 15-45s behind the actual charge. Previously we gave up after
    // ~10s and dropped the shopper on a "Payment not confirmed" screen even though
    // the webhook / reconcile cron confirmed the order seconds later. Poll for ~90s
    // (45 × 2s) — well beyond PayU's worst-case reflection window — and rely on the
    // parallel webhook to flip DB status the moment it lands.
    // A real PayU payment in production has taken up to ~3.5 minutes to become
    // visible through verify_payment. Keep the confirmation screen alive for
    // five minutes; pending is not failure and must never reopen checkout.
    // Plain UPI intents used to stop after only 8 polls (~14s). That fired the
    // "Still verifying with the bank" retry screen while the shopper was still
    // reading Instagram's "you are leaving the app" sheet or Android's app
    // chooser — the retry UI was literally visible behind the dialog. The
    // absolute WAIT_BUDGET_MS below is the real stop condition now.
    const maxAttempts = isDesktopQr ? 120 : (gatewayRef.current.pg === "payu" ? 150 : gatewayRef.current.pg ? 45 : 120);
    // Shopper-returned fast exit: if the tab was hidden (UPI app opened) and
    // then becomes visible again, the shopper is back on checkout. If they
    // actually paid, PayU/Razorpay reflect it within a few seconds. If they
    // backed out without paying, the old code kept them on "Complete your
    // payment" for the full 90s window. So once they're back we only give a
    // short grace period, then restore checkout with a retry option.
    let wentToApp = false;
    // A wait restored from storage usually means the shopper is ALREADY back on
    // our page (they cancelled or finished in the UPI app and navigated around
    // the store). Start the return grace immediately so they get a retry screen
    // instead of an endless spinner — but ONLY if this page is actually in the
    // foreground. Android WebViews routinely re-create the checkout while the
    // shopper is still inside GPay/PhonePe entering their PIN; presetting the
    // grace there would fail the attempt mid-payment.
    let returnedAt = (waitResumedRef.current && document.visibilityState === "visible") ? Date.now() : 0;

    // PayU's status API lags well behind the charge, so give it a longer grace
    // than plain intents — but never zero grace (that was the infinite spinner).
    const RETURN_GRACE_MS = gatewayRef.current.pg === "payu" ? 45000 : 12000;
    // Absolute wall-clock budget for THIS payment attempt. Because it is keyed
    // off the persisted wait timestamp, remounting checkout cannot reset it.
    if (!waitStartedAtRef.current) waitStartedAtRef.current = Date.now();
    const WAIT_BUDGET_MS = isDesktopQr ? 10 * 60 * 1000 : (gatewayRef.current.pg === "payu" ? 5 * 60 * 1000 : 3 * 60 * 1000);
    const budgetExpired = () => Date.now() - waitStartedAtRef.current >= WAIT_BUDGET_MS;
    const checkNow = async (): Promise<boolean> => {
      if (waitingCheckInFlightRef.current) return false;
      waitingCheckInFlightRef.current = true;
      try {
        // Read our authoritative order row FIRST. Instagram/FB WebViews often
        // suspend the direct PayU verifier fetch after returning from a UPI app.
        // The reconcile job/webhook may already have confirmed the order, but
        // the old ordering made the shopper wait up to 10s on PayU before every
        // local status read (or indefinitely in older WebViews with frozen
        // promises). A confirmed database row must always win immediately.
        const readOrderStatus = async () => {
          const { data } = await Promise.race([
            supabase.functions.invoke("order-payment-status", {
              body: { store_id: store.id, order_id: orderId },
            }),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error("Payment status check timed out")), 10000),
            ),
          ]);
          return (data as any)?.payment_status as string | undefined;
        };

        const initialStatus = await readOrderStatus().catch(() => undefined);
        if (initialStatus === "success") { finishSuccess(); return true; }
        if (initialStatus === "failed") {
          toast.error("Payment failed — please try again");
          clearWaiting(); setWaiting(false); setPendingOrder({ id: orderId!, number: orderNumber }); setPaymentFailed(true);
          try { window.dispatchEvent(new Event("payment-ended")); } catch { /* noop */ }
          try { fireStorefrontEvent({ storeId: store.id, eventName: "payment_failed" as any, metadata: { order_id: orderId } as any }); } catch { /* noop */ }
          return true;
        }

        // Still pending locally: ask the gateway for a fresh verdict. This can
        // update the order row when the webhook is delayed.
        const gatewayResult = await forceGatewayVerify();
        const verdict = normalizeGatewayResult(gatewayResult);
        if (verdict === "success") { finishSuccess(); return true; }
        if (verdict === "failed") {
          toast.error("Payment was cancelled — please try again");
          clearWaiting(); setWaiting(false); setPendingOrder({ id: orderId!, number: orderNumber }); setPaymentFailed(true);
          try { window.dispatchEvent(new Event("payment-ended")); } catch { /* noop */ }
          try { fireStorefrontEvent({ storeId: store.id, eventName: "payment_failed" as any, metadata: { order_id: orderId, gateway: gatewayRef.current?.pg } as any }); } catch { /* noop */ }
          return true;
        }
        // The gateway verifier may have confirmed the row. Read it once more
        // before scheduling the next poll so success is reflected this tick.
        const status = await readOrderStatus().catch(() => undefined);
        if (status === "success") { finishSuccess(); return true; }
        if (status === "failed") {
          toast.error("Payment failed — please try again");
          clearWaiting(); setWaiting(false); setPendingOrder({ id: orderId!, number: orderNumber }); setPaymentFailed(true);
          try { window.dispatchEvent(new Event("payment-ended")); } catch { /* noop */ }
          try { fireStorefrontEvent({ storeId: store.id, eventName: "payment_failed" as any, metadata: { order_id: orderId } as any }); } catch { /* noop */ }
          return true;
        }
      } catch { /* keep polling */ }
      finally { waitingCheckInFlightRef.current = false; }
      return false;
    };
    const poll = async () => {
      if (cancelled) return;
      // Only foreground polls count toward the attempt cap — background polls
      // while the shopper is in the UPI app must not burn the budget.
      if (document.visibilityState === "visible") attempts++;
      const done = await checkNow();
      if (done || cancelled) return;
      // Never fail an attempt while the shopper is away from this tab — a
      // hidden page means they are still inside the UPI app (PIN entry can take
      // well over the grace window). The grace only counts foreground time.
      const away = document.visibilityState !== "visible";
      if (away) returnedAt = 0;
      // While the shopper is INSIDE the UPI app (page hidden) we must never
      // end the wait — not on the return grace, not on the wall-clock budget,
      // not on the attempt cap. Otherwise a slow PIN entry / bank OTP past the
      // 3-minute budget lands them back on a "couldn't confirm" retry screen
      // for a payment that actually went through. Keep polling at a slow
      // cadence instead; the foreground checks below resolve it once they
      // come back.
      if (away) { setTimeout(poll, 4000); return; }
      if (!isDesktopQr && returnedAt && Date.now() - returnedAt >= RETURN_GRACE_MS) {
        stopWaitingForPayment("Payment not completed. Tap retry or choose another method.");
        return;
      }

      if (budgetExpired()) {
        stopWaitingForPayment("We couldn't confirm this payment. Tap retry or choose another method.");
        return;
      }
      if (attempts >= maxAttempts) {
        stopWaitingForPayment(isDesktopQr
          ? "Still not confirmed. If you completed payment, tap retry."
          : "Still verifying with the bank. If you paid, tap retry — we'll confirm your order.");
        return;
      }
      // QR: slow, steady cadence. Gateway redirect: fast at first, then steady 2s
      // so we ride out PayU's 15-45s reflection lag without hammering.
      // After the shopper is back from the UPI app, poll tightly so a real
      // payment confirms fast and a drop-off exits fast.
      const delay = isDesktopQr ? 2500 : (returnedAt ? 1500 : attempts < 5 ? 1200 : 2000);
      setTimeout(poll, delay);
    };
    setTimeout(poll, 600);
    const onFocus = () => { void checkNow(); };
    const onVis = () => {
      if (document.visibilityState === "hidden") { wentToApp = true; return; }
      // A restored wait counts as "already came back" the moment this page is
      // foregrounded, even if we never observed the hide (the tab was recreated
      // while the shopper was inside the UPI app).
      if ((wentToApp || waitResumedRef.current) && !returnedAt) returnedAt = Date.now();
      // If the shopper spent longer than the whole wall-clock budget inside the
      // UPI app, the budget is already blown the instant they return and they
      // would see "couldn't confirm" before a single foreground check runs.
      // Guarantee at least one full grace window of verification on return.
      if (budgetExpired()) {
        waitStartedAtRef.current = Date.now() - (WAIT_BUDGET_MS - RETURN_GRACE_MS);
      }
      void checkNow();
    };


    // iOS Safari restores the checkout from the back/forward cache after a UPI
    // round trip: JS timers stay frozen and `visibilitychange` may never fire,
    // so without a `pageshow` hook the poller sits idle and a PAID order looks
    // pending. `persisted` means we came back from bfcache — treat it exactly
    // like a return from the payment app.
    const onPageShow = () => {
      // iOS does not consistently mark pageshow as `persisted` after returning
      // from an external UPI app (especially Instagram/WhatsApp WKWebViews).
      // While a payment wait is active every pageshow is a safe, idempotent
      // reason to verify immediately.
      wentToApp = true;
      if (!returnedAt) returnedAt = Date.now();
      void checkNow();
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("online", onFocus);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("online", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };

  }, [waiting, orderId, waitingApp]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── LATE-CONFIRMATION WATCHER ────────────────────────────────────────────
  // Once the poller gives up we drop the shopper on the "Payment not completed"
  // retry card and stop checking entirely. But UPI/PayU confirmations regularly
  // land 1-5 minutes late (bank queue, webhook retry, reconcile cron). Without
  // this watcher a genuinely PAID order stays on a retry screen — and the
  // shopper pays a second time. Keep a quiet, low-frequency check running for
  // 8 more minutes; the moment the order flips to paid we jump to the success
  // screen with no interaction.
  useEffect(() => {
    if (!paymentFailed || !pendingOrder?.id || orderPlaced) return;
    let cancelled = false;
    const startedAt = Date.now();
    const MAX_MS = 8 * 60 * 1000;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      if (cancelled) return;
      if (Date.now() - startedAt >= MAX_MS) return;
      if (document.visibilityState === "visible" && !waitingCheckInFlightRef.current) {
        waitingCheckInFlightRef.current = true;
        try {
          const { data } = await supabase.functions.invoke("order-payment-status", {
            body: { store_id: store.id, order_id: pendingOrder.id },
          });
          if (!cancelled && (data as any)?.payment_status === "success") {
            finishSuccess(pendingOrder.id); return;
          }
          const gatewayResult = await forceGatewayVerify();
          if (!cancelled && normalizeGatewayResult(gatewayResult) === "success") {
            finishSuccess(pendingOrder.id); return;
          }
        } catch { /* keep watching */ }
        finally { waitingCheckInFlightRef.current = false; }
      }
      if (!cancelled) timer = setTimeout(tick, 6000);
    };
    timer = setTimeout(tick, 4000);
    const onVis = () => { if (document.visibilityState === "visible") void tick(); };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [paymentFailed, pendingOrder?.id, orderPlaced]); // eslint-disable-line react-hooks/exhaustive-deps

  const lastManualCheckRef = useRef(0);

  const manualRecheck = async () => {
    if (manualChecking || !orderId) return;
    const now = Date.now();
    if (now - lastManualCheckRef.current < 3000) {
      toast("Please wait a moment before checking again");
      return;
    }
    lastManualCheckRef.current = now;
    setManualChecking(true);
    try {
      const gatewayResult = await forceGatewayVerify();
      const verdict = normalizeGatewayResult(gatewayResult);
      if (verdict === "success") { finishSuccess(); return; }
      if (verdict === "failed") {
        toast.error("Payment was cancelled — please try again");
        clearWaiting(); setWaiting(false); setPendingOrder({ id: orderId!, number: orderNumber }); setPaymentFailed(true);
        invalidateUpiIntents();
        try { window.dispatchEvent(new Event("payment-ended")); } catch { /* noop */ }
        return;
      }

      const { data } = await supabase.functions.invoke("order-payment-status", {
        body: { store_id: store.id, order_id: orderId },
      });
      const status = (data as any)?.payment_status;
      if (status === "success") { finishSuccess(); return; }
      if (status === "failed") { toast.error("Payment failed — please try again"); clearWaiting(); setWaiting(false); setPendingOrder({ id: orderId!, number: orderNumber }); setPaymentFailed(true); invalidateUpiIntents(); try { window.dispatchEvent(new Event("payment-ended")); } catch { /* noop */ } return; }
      toast("Not confirmed yet — please complete the payment in your UPI app");
    } finally { setManualChecking(false); }
  };


  const tapUpiApp = (app: UpiApp, event?: MouseEvent<HTMLAnchorElement | HTMLButtonElement>, opts?: { gesture?: boolean }) => {
    const gesture = opts?.gesture !== false;
    event?.preventDefault();
    // Telemetry: EVERY tile tap is recorded with the branch it took. Without
    // this we could only see launches, so "I tapped PhonePe and nothing
    // happened" was invisible in analytics (322 continue_to_pay vs 44 launches).
    const trackTap = (outcome: string) => {
      try {
        fireStorefrontEvent({
          storeId: store.id,
          eventName: "pay_click" as any,
          metadata: { step: "upi_tile", outcome, gesture, method: `upi_${app}`, dev: deviceTag() } as any,
        });
      } catch { /* noop */ }
    };
    // Instant tactile + visual acknowledgement of the tap. Runs before any
    // guard so the shopper always *feels* the press, even when we end up
    // re-minting instead of launching.
    flashUpiTap(app);
    // Queue the tap while the order/intent is still being prepared, so the
    // launch happens automatically the instant it's ready (no second tap).
    const queueTap = () => {
      pendingUpiTapRef.current = { app, at: Date.now() };
      flashUpiTap(app, PENDING_TAP_TTL_MS);
    };
    if (creatingOrder || couponLoading || paymentAmountSyncing) {
      trackTap("queued_preparing");
      queueTap();
      return;
    }
    // PAYMENT-FIRST address gate — if no address, open the sheet and remember
    // this tap so we auto-resume the UPI launch after the shopper saves.
    if (!requireAddressOrPrompt(() => tapUpiApp(app, undefined, { gesture: false }))) { trackTap("address_gate"); pendingUpiTapRef.current = null; clearUpiTapFx(); return; }
    const s = intents[app];
    // A failed tile used to be a dead end (silent return + pointer-events-none),
    // so a shopper who hit one transient gateway error could never pay by UPI
    // again in that session. Treat the tap as an explicit retry.
    if (s.status === "failed") {
      mintCountRef.current = 0;
      mintLoopBlockedRef.current = false;
      lastMintAtRef.current = 0;
      toast.info("Retrying…");
      trackTap("queued_failed_remint");
      queueTap();
      void createOrderAndIntents({ userInitiated: true });
      return;
    }
    if (s.status !== "ready" || !s.url) {
      // Still minting (or not started yet) — remember the tap and make sure a
      // mint is actually in flight, then let the pending-tap effect launch it.
      trackTap(s.status === "idle" ? "queued_idle" : "queued_minting");
      queueTap();
      if (s.status === "idle") void createOrderAndIntents({ userInitiated: true });
      return;
    }
    pendingUpiTapRef.current = null;

    // Stale-intent guard: the minted URL encodes a fixed amount. If the
    // shopper toggled Partial/Full (or coupon/shipping shifted the total)
    // between mint and tap, refuse the launch and force a re-mint so the
    // UPI app never opens for the wrong amount.
    if (typeof s.amount === "number" && Math.round(s.amount * 100) !== Math.round(chargeAmount * 100)) {
      toast.info("Updating amount…");
      trackTap("queued_amount_changed");
      queueTap();
      void createOrderAndIntents({ userInitiated: true });
      return;
    }

    // Expired-intent guard: the gateway's transaction reference inside the
    // `upi://` URL has a limited lifetime. A shopper who left the checkout open
    // for 10+ minutes and then tapped GPay used to get the app opening on a
    // transaction the bank immediately declines. Re-mint instead — the queued
    // tap fires automatically the moment the fresh intent is ready.
    if (typeof s.at === "number" && Date.now() - s.at > UPI_INTENT_MAX_AGE_MS) {
      mintCountRef.current = 0;
      mintLoopBlockedRef.current = false;
      lastMintAtRef.current = 0;
      toast.info("Refreshing payment…");
      trackTap("queued_intent_expired");
      queueTap();
      void createOrderAndIntents({ userInitiated: true });
      return;
    }


    const label = UPI_APPS.find((u) => u.key === app)?.label || "UPI";

    // A custom-scheme navigation triggered WITHOUT a live user gesture (queued
    // tap replayed once the intent finished minting, address-sheet resume, a
    // re-mint after a cancelled attempt) is silently dropped by iOS
    // Safari/WKWebView AND by Android in-app webviews (Instagram/Facebook/
    // WhatsApp), which enforce a user-activation window for external schemes.
    // The shopper then sits on an armed "Complete payment" screen while nothing
    // ever opens. Ask for one fresh tap instead; the intent is ready by then so
    // it launches instantly. Real Chrome/Safari-on-Android is exempt — it
    // honours the deferred navigation.
    const needsFreshGesture = isIOS() || !deviceTag().endsWith(":browser");
    if (needsFreshGesture && !gesture) {
      pendingUpiTapRef.current = null;
      clearUpiTapFx();
      toast.info(`Ready — tap ${label} to open the app`, { duration: 5000 });
      trackTap("retap_prompt");
      return;
    }



    // New attempt supersedes any previous one: tear down its listeners and
    // invalidate its pending timers.
    try { launchCleanupRef.current?.(); } catch { /* noop */ }
    const seq = ++launchSeqRef.current;
    const isStale = () => launchSeqRef.current !== seq;

    let leftCheckout = false;
    let waitingArmed = false;
    const armWaiting = () => {
      if (waitingArmed || isStale()) return;
      waitingArmed = true;
      persistWaiting(app, label);
      setWaitingApp(label);
      setWaiting(true);
      try { window.dispatchEvent(new Event("payment-in-progress")); } catch { /* noop */ }
    };
    const markLeft = () => {
      leftCheckout = true;
      armWaiting();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") markLeft();
    };
    // Universal chooser fallback: fired at most once per tap, either because
    // Chrome bounced us to the `#upi_fb` fallback (app not installed) or
    // because nothing happened at all after 2.6s.
    let chooserFired = false;
    const anyUpiUrl = genericUpiUrl(s.url);
    const fireChooser = () => {
      if (chooserFired || leftCheckout || isStale()) return;
      chooserFired = true;
      if (anyUpiUrl && anyUpiUrl !== s.url) launchUpiUrl(anyUpiUrl);
    };
    const onHashFallback = () => {
      if (!window.location.hash.includes(UPI_FALLBACK_HASH)) return;
      try {
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
      } catch { /* noop */ }
      // Android could not start the UPI intent at all. Try the raw `upi://`
      // link once (some OEM browsers resolve it even when they bounce the
      // intent URL); if that also does nothing, release the shopper straight
      // away instead of holding them on a 90s spinner.
      fireChooser();
      window.setTimeout(() => {
        if (isStale() || leftCheckout) return;
        if (document.visibilityState !== "visible") return;
        try { if (!document.hasFocus()) return; } catch { /* noop */ }
        try { stopWaitingForPayment("No UPI app found on this phone. Try another app or pay by card."); } catch { /* noop */ }
        try { fireStorefrontEvent({ storeId: store.id, eventName: "payment_failed" as any, metadata: { reason: "android_no_upi_app_fallback", method: `upi_${app}`, dev: deviceTag() } as any }); } catch { /* noop */ }
      }, 3500);
    };

    const cleanupLaunchListeners = () => {
      window.removeEventListener("blur", markLeft);
      window.removeEventListener("pagehide", markLeft);
      window.removeEventListener("hashchange", onHashFallback);
      document.removeEventListener("visibilitychange", onVisibility);
      if (launchCleanupRef.current === cleanupLaunchListeners) launchCleanupRef.current = null;
    };
    launchCleanupRef.current = cleanupLaunchListeners;
    window.addEventListener("blur", markLeft, { once: true });
    window.addEventListener("pagehide", markLeft, { once: true });
    window.addEventListener("hashchange", onHashFallback);
    document.addEventListener("visibilitychange", onVisibility);

    // Arm waiting BEFORE navigating. WhatsApp/Instagram in-app browsers can
    // show their "leave site" prompt before blur/pagehide reliably fires; if
    // we wait for blur, the shopper can return to a normal checkout with no
    // polling active even though the bank payment succeeded.
    armWaiting();

    // Hand off in the SAME tick as the tap on every device. Android Chrome,
    // OEM browsers and in-app webviews all enforce a user-activation window
    // for external-scheme navigations: any timer risks the hop being dropped
    // silently ("I tapped PhonePe and nothing happened; after cancel + retry
    // it opened"). The "Complete payment in <app>" screen is already armed
    // above, so the shopper still gets the status UI.
    const inAppWebview = !deviceTag().endsWith(":browser");
    trackTap("launch");
    launchUpiUrl(s.url);




    // How long we wait before concluding "no payment app ever opened".
    //
    // The old 6.2s budget was far too aggressive: Android Chrome shows an
    // "Open with PhonePe?" system dialog, and Instagram/FB webviews show a
    // "You are leaving the app" confirmation. While either dialog is up the
    // page is STILL visible + focused, so we were declaring failure and
    // flipping the shopper to "retry payment" seconds before they tapped
    // Continue — the app then opened onto an already-abandoned attempt.
    //
    // Give a full 90s (and 2 min inside in-app webviews, where the extra
    // confirm step is guaranteed) before releasing the wait screen.
    const NO_APP_TIMEOUT_MS = inAppWebview ? 120000 : 90000;

    if (isAndroid() && !inAppWebview) {
      // Recovery for "the tap did nothing" on real Android Chrome only.
      //
      // Re-attempt the EXACT same launch once (some OEM WebViews swallow the
      // first external-scheme hop). Deliberately never escalate to the generic
      // `upi://` chooser here: for the direct-open tiles (GPay / PhonePe) that
      // would pop the very app-picker sheet the tile exists to avoid, and the
      // real "app not installed" case is already handled instantly by the
      // `#upi_fb` browser_fallback_url hop.
      //
      // Deliberately NOT done in in-app webviews: there the first hop opens a
      // "leaving the app" confirm sheet, and a second navigation while that
      // sheet is open cancels it. Also pushed out to 12s so a slow chooser
      // dialog is never interrupted.
      window.setTimeout(() => {
        if (isStale() || leftCheckout || document.visibilityState !== "visible") return;
        try { if (!document.hasFocus()) return; } catch { /* noop */ }
        if (chooserFired) return;
        chooserFired = true;
        launchUpiUrl(s.url);
      }, 12000 + UPI_LAUNCH_DELAY_MS);

    }


    // Pixels and analytics run after the app launch has already been handed off.
    window.setTimeout(() => {
      try { fireStorefrontEvent({ storeId: store.id, eventName: "pay_click" as any, metadata: { method: `upi_${app}`, dev: deviceTag() } as any }); } catch { /* noop */ }
      fireInitiateCheckoutOnce();
      fireAddPaymentInfoOnce(`upi_${app}`, chargeAmount);
    }, 0);

    const launchedAt = Date.now();
    window.setTimeout(() => {
      // A newer tap owns the wait screen now — never cancel it.
      if (isStale()) return;
      cleanupLaunchListeners();
      if (leftCheckout || document.visibilityState !== "visible") {
        armWaiting();
        return;
      }
      try { if (!document.hasFocus()) return; } catch { /* noop */ }
      if (Date.now() - launchedAt >= NO_APP_TIMEOUT_MS - 200) {
        // Nothing ever came to the foreground on either OS — never strand the
        // shopper on a spinner for a payment app that never opened.
        const msg = isIOS()
          ? `${label} is not installed on this iPhone. Choose another app or pay by card.`
          : `No UPI app opened. Tap ${label} again or pay by card.`;
        try { stopWaitingForPayment(msg); } catch { /* noop */ }
        try { fireStorefrontEvent({ storeId: store.id, eventName: "payment_failed" as any, metadata: { reason: isIOS() ? "ios_app_not_installed" : "android_no_upi_app", method: `upi_${app}`, dev: deviceTag() } as any }); } catch { /* noop */ }
      }
    }, NO_APP_TIMEOUT_MS);

  };



  // Keep a live ref so the pending-tap effect always calls the current closure.
  tapUpiAppRef.current = tapUpiApp;

  // ONE-TAP UPI: auto-resume a queued tap the moment its intent is ready.
  useEffect(() => {
    const pending = pendingUpiTapRef.current;
    if (!pending) return;
    if (Date.now() - pending.at > PENDING_TAP_TTL_MS) {
      pendingUpiTapRef.current = null;
      clearUpiTapFx();
      return;
    }
    if (waiting || orderPlaced || confirmingPayment) {
      pendingUpiTapRef.current = null;
      return;
    }
    if (creatingOrder || couponLoading || paymentAmountSyncing) return;
    const s = intents[pending.app];
    if (s.status === "failed") {
      pendingUpiTapRef.current = null;
      clearUpiTapFx();
      return;
    }
    if (s.status !== "ready" || !s.url) return;
    if (typeof s.amount === "number" && Math.round(s.amount * 100) !== Math.round(chargeAmount * 100)) return;
    pendingUpiTapRef.current = null;
    tapUpiAppRef.current?.(pending.app, undefined, { gesture: false });
  }, [intents, creatingOrder, couponLoading, paymentAmountSyncing, chargeAmount, waiting, orderPlaced, confirmingPayment]);



  // ─── Restore waiting state on mount / PayU redirect-back ────────────────
  // Also fires a one-shot server-side reconciliation so shoppers who reload
  // after paying (webhook already landed) see success instantly instead of
  // being stuck on the "waiting" screen re-polling.
  useEffect(() => {
    if (!store?.id) return;
    try {
      // Normal UPI intents persist WAIT_KEY. PayU Bolt historically persisted a
      // separate payu_pending key, so a full mobile-webview reload after opening
      // PhonePe/GPay lost the active order and rendered a fresh checkout/address
      // form. Accept that durable record as a recovery fallback as well.
      let raw = sessionStorage.getItem(WAIT_KEY) || localStorage.getItem(WAIT_KEY);
      if (!raw && store?.id) {
        const payuRaw = sessionStorage.getItem(`payu_pending_${store.id}`)
          || localStorage.getItem(`payu_pending_${store.id}`);
        if (payuRaw) {
          const payuSaved = JSON.parse(payuRaw);
          raw = JSON.stringify({
            orderId: payuSaved?.order_id,
            orderNumber: payuSaved?.order_number,
            app: "any",
            label: "PayU",
            gateway: { pg: "payu", payu_txnid: payuSaved?.txnid },
            ts: payuSaved?.ts,
          });
        }
      }
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (!saved?.orderId) return;
      if (Date.now() - (saved.ts || 0) > 15 * 60 * 1000) { clearWaiting(); return; }
      // Keep the ORIGINAL attempt timestamp so the poller's absolute budget
      // survives this remount (otherwise a shopper who cancels in the UPI app
      // and re-enters checkout restarts the wait forever).
      waitStartedAtRef.current = Number(saved.ts) || Date.now();
      waitResumedRef.current = true;
      setOrderId(saved.orderId);
      setOrderNumber(saved.orderNumber || null);
      setShowPayment(true);
      setWaitingApp(saved.label || "UPI");
      gatewayRef.current = saved.gateway || {};
      setWaiting(true);
      // Kick a single reconciliation immediately — if webhook already flipped
      // the row to `confirmed`, this short-circuits to the success screen.
      if (store?.id && saved.orderId) {
        void supabase.functions
          .invoke("order-payment-status", { body: { store_id: store.id, order_id: saved.orderId } })
          .then(({ data }) => {
            const st = (data as any)?.payment_status;
            if (st === "success") { finishSuccess(saved.orderId); }
            else if (st === "failed") {
              clearWaiting();
              setWaiting(false);
              setPendingOrder({ id: saved.orderId, number: saved.orderNumber || null });
              setPaymentFailed(true);
            }
          })
          .catch(() => { /* poll effect will retry */ });
      }
    } catch { /* noop */ }
    // The store is commonly unavailable on the first render after iOS
    // recreates a WKWebView. Re-run when it hydrates; the old empty dependency
    // array permanently missed WAIT_KEY and rendered a fresh checkout instead
    // of restoring the paid order's confirmation flow.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store?.id]);


  useEffect(() => {
    if (!store?.id) return;
    // Android recent-app restore / WebView bfcache can replay the exact PayU
    // return URL after this mount has already reached confirmation. Never let a
    // stale redirect re-arm the processing screen for a completed order.
    // `confirmingPayment` is transient and may be stuck when Instagram freezes
    // an in-flight PayU request. It must never veto redirect recovery; only the
    // terminal success state is safe to ignore.
    if (orderPlaced) return;
    const params = new URLSearchParams(window.location.search);
    const payuStatus = params.get("payu_status");
    const txnid = params.get("txnid");
    const returnedOrderId = params.get("payu_order");
    if (!payuStatus || !txnid || !returnedOrderId) return;
    // Consume redirect parameters before setting state. This makes StrictMode,
    // fast remounts, and duplicate pageshow events idempotent.
    try {
      const u = new URL(window.location.href);
      u.searchParams.delete("payu_status");
      u.searchParams.delete("txnid");
      u.searchParams.delete("payu_order");
      window.history.replaceState({}, "", u.toString());
    } catch { /* noop */ }
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
      // Kick a strong server-side verify immediately (in parallel with the
      // polling loop) so we don't wait a full poll-tick before asking PayU.
      // Idempotent — if webhook already confirmed, this short-circuits.
      try {
        void supabase.functions
          .invoke("payu-verify-payment", {
            body: { store_id: store.id, order_id: returnedOrderId, txnid },
          })
          .catch(() => { /* polling will catch it */ });
      } catch { /* noop */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store?.id, orderPlaced]);

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

  // ─── Recently-completed order guard (back-nav from order detail) ────────
  // The success screen lives on the /checkout route itself, so pressing Back
  // from the order-detail page remounts checkout with orderPlaced=false. Read
  // the durable localStorage marker written by onOrderSuccess (survives the
  // Instagram/FB in-app-browser sessionStorage wipe) and bounce the shopper
  // back to their order instead of dropping them into a live checkout.
  const readRecentOrder = useCallback((): { ordId: string; at: number; sig?: string } | null => {
    if (!store?.id) return null;
    try {
      const raw = localStorage.getItem(`sb_last_order:${store.id}`);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { ordId: string; at: number; sig?: string };
      if (!parsed?.ordId) return null;
      if (Date.now() - Number(parsed.at) > 10 * 60 * 1000) return null;
      return parsed;
    } catch {
      return null;
    }
  }, [store?.id]);

  // ─── Empty cart guard (skip in buy-now single mode) ─────────────────────
  // Must be declared unconditionally BEFORE any early returns below,
  // otherwise flipping orderPlaced/waiting after a payment-return would
  // change the hook count and crash the page ("Rendered fewer hooks…").
  useEffect(() => {
    if (isSingleMode) return;
    if (orderId || orderPlaced || waiting || confirmingPayment) return;
    if (checkoutItems.length !== 0) return;
    // On iOS the cart can hydrate one render later than this page after the OS
    // recreates a payment tab. Never redirect away while durable payment
    // recovery exists, even before the restore effect's state updates commit.
    try {
      if (sessionStorage.getItem(WAIT_KEY) || localStorage.getItem(WAIT_KEY)) return;
    } catch { /* continue with the normal empty-cart guard */ }
    if (summaryOpen) setSummaryOpen(false);
    // Cart is empty because we JUST cleared it on a successful order — send
    // them to that order, not to a confusing "your cart is empty" home bounce.
    const recent = readRecentOrder();
    if (recent) {
      // Send them home, NOT back to the order — bouncing to order detail here
      // created a visible checkout↔order flicker when Back was pressed.
      navigate(storefrontPath(store.slug), { replace: true });
      return;
    }
    toast("Your cart is empty — add items to continue");
    navigate(storefrontPath(store.slug), { replace: true });
  }, [checkoutItems.length, isSingleMode, orderId, orderPlaced, waiting, confirmingPayment, summaryOpen, navigate, store?.slug, readRecentOrder]);

  // Re-ordering the same product is intentionally allowed: no "just ordered
  // this" redirect. Buy-Now checkout always re-hydrates normally.






  // ─── Create/update order (dedup with checkout_token) ────────────────────
  // The checkout_token stays stable for the whole attempt. When plan/coupon/
  // qty/address changes, place-order updates the SAME pending row instead of
  // minting a new row. This prevents 4-5 pending orders from one shopper who
  // toggles Partial↔Full while still keeping gateway amounts DB-authoritative.
  const cancelStalePendingOrder = (oid: string | null, token: string | null) => {
    if (!oid || !token || !store?.id) return;
    try {
      void supabase.functions
        .invoke("cancel-pending-order", {
          body: { store_id: store.id, order_id: oid, checkout_token: token },
        })
        .catch(() => { /* swallow — non-critical cleanup */ });
    } catch { /* noop */ }
  };

  const createOrderIfNeeded = async (
    paymentMethodHint: string,
    opts?: { userInitiated?: boolean },
  ): Promise<PendingOrder> => {
    const userInitiated = opts?.userInitiated === true;
    // Nothing may mint another order from this mounted checkout once success
    // has been committed. A second rapid COD tap is still `userInitiated`, so
    // exempting explicit taps here allowed that stale call to re-arm checkout.
    // A genuinely new checkout mounts this page afresh with a new token.
    if (orderPlacedRef.current) {
      throw new Error("checkout_already_completed");
    }
    // A previous order in THIS tab already consumed the idempotency token
    // (success screen → shopper browsed to another product → new checkout).
    // Start clean, otherwise place-order would return the old paid order and
    // the UPI tiles would fail with already_paid.
    if (tokenRetiredRef.current) {
      throw new Error("checkout_already_completed");
    }


    // NOTE: no duplicate-order block here. A shopper may re-order the exact
    // same product again immediately — we only reuse the in-flight order row
    // when it is literally the one this mount already minted.
    try {
      const raw = localStorage.getItem(`sb_last_order:${store.id}`);
      if (raw) {
        const parsed = JSON.parse(raw) as { ordId: string; at: number; sig?: string };
        const fresh = parsed?.ordId && Date.now() - Number(parsed.at) < 3 * 60 * 1000;
        if (fresh && orderIdRef.current && orderIdRef.current === parsed.ordId) {
          return { id: parsed.ordId, number: orderNumberRef.current };
        }
        if (!fresh) { try { localStorage.removeItem(`sb_last_order:${store.id}`); } catch { /* noop */ } }
      }
    } catch { /* localStorage / JSON errors — non-fatal, fall through */ }



    // COD forces payment_type=full even when the shopper had "advance"
    // pre-selected. Fold that into the snapshot so a stale partial-mode
    // row minted for an earlier PayU attempt is discarded before we hit
    // checkout-v2-cod (which rejects partial orders).
    const resolvedType: "full" | "partial" =
      paymentMethodHint === "cod" ? "full" : effectiveMode;
    const effectiveSnapshot = `${orderDetailsSnapshot}|pt:${resolvedType}|pm:${paymentMethodHint === "cod" ? "cod" : "online"}`;
    if (orderIdRef.current && orderSnapshotRef.current === effectiveSnapshot) {
      return { id: orderIdRef.current, number: orderNumberRef.current };
    }
    if (orderIdRef.current && orderSnapshotRef.current !== effectiveSnapshot) {
      // Discard only the local payment intent/snapshot. Do NOT cancel the DB
      // row or rotate checkout_token here — the backend will update that same
      // pending row with the new payment type/amount/items.
      orderIdRef.current = null;
      orderNumberRef.current = null;
      setOrderId(null);
      setOrderNumber(null);
    }
    const created = await placeOrderRow(paymentMethodHint, resolvedType, 0, userInitiated);
    orderIdRef.current = created.id;
    orderNumberRef.current = created.number;
    orderSnapshotRef.current = effectiveSnapshot;
    setOrderId(created.id);
    setOrderNumber(created.number);
    return created;
  };


  // ─── UPI intent-based flow (mobile-first) ───────────────────────────────
  const createOrderAndIntents = async (opts?: { userInitiated?: boolean }): Promise<void> => {
    const userInitiated = opts?.userInitiated === true;

    // HARD STOP after a confirmed payment. Deferred/queued automatic mints that
    // land post-success were creating a duplicate pending order (same phone,
    // same product, ~1 min later). A genuine new checkout always comes through
    // an explicit tap (userInitiated) which unfreezes this in createOrderIfNeeded.
    if (orderPlacedRef.current && !userInitiated) return;



    // PAYMENT-FIRST guard. `showPayment` is revealed as soon as the phone gate
    // clears, so every automatic re-mint (coupon resolve, config load, snapshot
    // change) used to run validateAddress() against an empty form and fire a red
    // "Please enter your name" toast at a shopper who had done nothing wrong.
    // That single false-positive accounted for ~75% of all checkout_field_error
    // events. Automatic triggers now no-op silently until the address exists.
    if (!addressCompleteRef.current) {
      if (!userInitiated) return;
      const err0 = validateAddress();
      if (err0) {
        toast.error(err0);
        try { fireStorefrontEvent({ storeId: store.id, eventName: "checkout_field_error" as any, metadata: { error: err0, src: "pay" } as any }); } catch { /* noop */ }
        return;
      }
    }

    if (createOrderPromiseRef.current) {
      remintAfterCurrentOrderRef.current = true;
      return createOrderPromiseRef.current;
    }

    // Wait for the auto-apply coupon lookups (they resolve in ~100ms) so the
    // minted amount already includes the discount. Capped at ~1.5s so a slow
    // RPC can never block checkout.
    if (!couponsResolvedRef.current && !appliedCoupon && couponWaitTriesRef.current < 10) {
      couponWaitTriesRef.current += 1;
      window.setTimeout(() => { void createOrderAndIntents(opts); }, 150);
      return;
    }



    // Hard cap: if we've minted too many times or too rapidly for one
    // checkout session, stop the loop. The shopper still has a working
    // ready intent from the last successful mint; forcing another round
    // would just DOS ourselves and burn rate-limit budget.
    const now = Date.now();
    if (mintLoopBlockedRef.current) {
      // Surface a failed state on the UPI tiles so the shopper sees a retry
      // affordance instead of a spinner that never resolves.
      const apps: UpiApp[] = ["gpay", "phonepe", "paytm", "bhim", "any"];
      setIntents((s) => { const next = { ...s }; apps.forEach((a) => { next[a] = { status: "failed", error: "Tap to retry" }; }); return next; });
      return;
    }
    if (mintCountRef.current >= 8) {
      mintLoopBlockedRef.current = true;
      console.warn("[checkout] mint loop cap hit — halting re-mints for this session");
      const apps: UpiApp[] = ["gpay", "phonepe", "paytm", "bhim", "any"];
      setIntents((s) => { const next = { ...s }; apps.forEach((a) => { next[a] = { status: "failed", error: "Tap to retry" }; }); return next; });
      return;
    }
    if (now - lastMintAtRef.current < 2500) {
      // Coalesce rapid triggers into a single deferred mint.
      if (!remintAfterCurrentOrderRef.current) {
        remintAfterCurrentOrderRef.current = true;
        const delay = 2500 - (now - lastMintAtRef.current);
        window.setTimeout(() => {
          if (!createOrderPromiseRef.current && remintAfterCurrentOrderRef.current) {
            remintAfterCurrentOrderRef.current = false;
            void createOrderAndIntents(opts);
          }
        }, Math.max(delay, 50));
      }
      return;
    }
    lastMintAtRef.current = now;
    mintCountRef.current += 1;

    const run = (async () => {
      const err = validateAddress();
      if (err) {
        // Only a real tap deserves a red toast. Background re-mints (coupon
        // resolve, snapshot change, payment-config load) must fail silently —
        // shouting at a shopper who did nothing was the single biggest
        // checkout drop-off trigger.
        if (userInitiated) {
          toast.error(err);
          try { fireStorefrontEvent({ storeId: store.id, eventName: "checkout_field_error" as any, metadata: { error: err, src: "mint" } as any }); } catch { /* noop */ }
        }
        return;
      }
      if (checkoutItems.length === 0) { if (userInitiated) toast.error("Your cart is empty"); return; }

      // Note: intentionally NOT waiting on paymentConfigLoaded — server picks the gateway.

      setCreatingOrder(true);
      try {
        saveExpressInfo();
        // STRICT GATEWAY: the order is always stamped with the store's actual
        // enabled gateway. No fallback label — if nothing is enabled we abort
        // instead of writing a gateway the store doesn't use.
        if (!activeGateway) {
          toast.error("No online payment gateway configured");
          return;
        }
        const order = await createOrderIfNeeded(activeGateway, { userInitiated });
        setShowPayment(true);
        try { fireStorefrontEvent({ storeId: store.id, eventName: "pay_click" as any, metadata: { step: "continue_to_pay", dev: deviceTag() } as any }); } catch { /* noop */ }

        const apps: UpiApp[] = ["gpay", "phonepe", "paytm", "bhim", "any"];
        // Hosted-gateway mode: this store's gateway cannot mint direct UPI
        // intents, so skip the round-trip entirely. The order is created (above)
        // and every tile hands off to the gateway's own UPI page on tap.
        if (gatewayOnlyRef.current) {
          setIntents((s) => { const next = { ...s }; apps.forEach((a) => { next[a] = { status: "idle" }; }); return next; });
          return;
        }
        setIntents((s) => { const next = { ...s }; apps.forEach((a) => { next[a] = { status: "loading" }; }); return next; });

        // Fresh intent = fresh QR — allow the desktop auto-poll to arm again.
        desktopQrPollStartedRef.current = false;

        // Stamp the amount BEFORE invoking. If the shopper toggles Partial↔Full
        // while the request is in flight, this captured value diverges from the
        // live chargeAmount and we discard the stale response instead of
        // rendering a QR for the wrong price.
        const requestedAmount = chargeAmount;
        try {
          // Hard 15s timeout — supabase-js invoke has no default timeout, so a
          // hung gateway upstream would leave the QR spinning forever. Race the
          // invoke against an AbortError so we always resolve to ready/failed.
          const invokePromise = supabase.functions.invoke("create-upi-intent", {
            body: {
              store_id: store.id, order_id: order.id, app: "any",
              customer_name: fullName.trim(), customer_phone: toCanonicalIndianPhone(phone) || normalizePhone(phone),
              customer_email: email.trim() || undefined,
              return_url: buildPaymentReturnUrl(),
              amount: requestedAmount,
            },
          });
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Payment gateway timed out. Please retry.")), 15000)
          );
          const { data: intentData, error: intErr } = await Promise.race([invokePromise, timeoutPromise]) as any;
          // Discard if the shopper switched plans mid-flight — a fresh mint is queued after this run finishes.
          if (Math.round(requestedAmount * 100) !== Math.round(chargeAmount * 100)) {
            remintAfterCurrentOrderRef.current = true;
            discardedMintRef.current = true;
            return;
          }

          const payload: any = intentData ?? (intErr as any)?.context?.body;
          // The gateway refused a new intent because a previous attempt on this
          // same order was already captured. Never show a failure here — the
          // shopper has paid, so jump straight to the confirmation screen.
          if (payload?.already_paid || payload?.code === "order_already_paid") {
            setOrderId(order.id);
            finishSuccess();
            return;
          }
          const url: string | undefined = payload?.intent_url;
          if (!url) {
            const errMsg: string = payload?.error || intErr?.message || "UPI temporarily unavailable";
            // Gateways other than PayU commonly lack S2S UPI approval. Rather
            // than dead-ending the shopper, switch to the hosted gateway page.
            if (activeGateway !== "payu") {
              console.warn("[checkout] UPI intent unavailable — hosted gateway mode:", errMsg);
              enableGatewayOnly();
              setIntents((s) => { const next = { ...s }; apps.forEach((a) => { next[a] = { status: "idle" }; }); return next; });
              // A real tap must not end in silence: continue straight into the
              // gateway's own payment page (runs after `creatingOrder` clears).
              if (userInitiated) window.setTimeout(() => { void startGatewayPayment(); }, 80);
              return;
            }

            setIntents((s) => { const next = { ...s }; apps.forEach((a) => { next[a] = { status: "failed", error: errMsg }; }); return next; });

          } else {
            if (payload?.pg) {
              gatewayRef.current = {
                pg: payload.pg, cf_order_id: payload.cf_order_id,
                payu_txnid: payload.payu_txnid, razorpay_payment_id: payload.razorpay_payment_id,
              };
            }
            lastMintedAmountRef.current = requestedAmount;
            setIntents((s) => { const next = { ...s }; apps.forEach((a) => { next[a] = { status: "ready", url: schemeFor(a, url), amount: requestedAmount, at: Date.now() }; }); return next; });
          }
        } catch (e: any) {
          // Ignore late failures from a request that no longer matches the current amount.
          if (Math.round(requestedAmount * 100) !== Math.round(chargeAmount * 100)) {
            remintAfterCurrentOrderRef.current = true;
            discardedMintRef.current = true;
            return;
          }

          const msg = e?.message || "UPI temporarily unavailable";
          setIntents((s) => { const next = { ...s }; apps.forEach((a) => { next[a] = { status: "failed", error: msg }; }); return next; });
        }
      } catch (e: any) {
        const rawErrMsg = String(e?.message || "");
        // Benign: a stale automatic mint raced a confirmed payment. Stay silent
        // and leave the success screen alone — no toast, no failed UPI tiles.
        if (rawErrMsg === "checkout_already_completed") return;
        const rawMsg = rawErrMsg === "recent_order_guard"
          ? "You just placed this same order a moment ago. Please check My Orders."
          : rawErrMsg;
        const rateLimited = /too many attempts/i.test(rawMsg);
        // A 429 here is almost always a shopper who reloaded / toggled plans a
        // few times, not an attacker. Dead-ending them with a permanent error
        // loses the sale, so schedule one automatic retry once the window has
        // moved on, and tell them what is happening.
        if (rateLimited) {
          toast.error("Just a moment — reconnecting to the payment gateway…");
          if (!rateLimitRetryRef.current) {
            rateLimitRetryRef.current = true;
            window.setTimeout(() => {
              rateLimitRetryRef.current = false;
              mintCountRef.current = 0;
              mintLoopBlockedRef.current = false;
              lastMintAtRef.current = 0;
              void createOrderAndIntents(opts);
            }, 20000);
          }
        } else {
          toast.error(rawMsg || "Failed to create order");
        }
        // Surface failure on UPI tiles so the shopper sees a retry state
        // instead of buttons stuck in permanently-disabled "idle" (blue/faded)
        // after rapid Partial↔Full toggles trigger a 429 or transient error.
        const apps: UpiApp[] = ["gpay", "phonepe", "paytm", "bhim", "any"];
        const msg = rateLimited
          ? "Reconnecting… this will retry automatically in a few seconds."
          : (rawMsg || "Payment temporarily unavailable. Tap retry.");
        setIntents((s) => { const next = { ...s }; apps.forEach((a) => { next[a] = { status: "failed", error: msg }; }); return next; });
        // Do not reset autoAdvancedRef here: repeated automatic retries can hammer place-order and 429-lock real buyers.
      } finally {
        setCreatingOrder(false);
      }
    })();

    createOrderPromiseRef.current = run.finally(() => {
      createOrderPromiseRef.current = null;
      const mintedAmount = lastMintedAmountRef.current;
      const amountStillMatches = mintedAmount != null &&
        Math.round(mintedAmount * 100) === Math.round(chargeAmount * 100);
      // A discarded mid-flight response left the tiles on "loading" with no
      // usable intent — always re-mint in that case, even if an older mint's
      // amount happens to match the current charge.
      const forceRemint = discardedMintRef.current;
      discardedMintRef.current = false;
      if (remintAfterCurrentOrderRef.current && !confirmingPayment && !orderPlaced &&
          !orderPlacedRef.current && (forceRemint || !amountStillMatches)) {
        remintAfterCurrentOrderRef.current = false;
        // Reset the rapid-fire coalescer so this recovery mint isn't swallowed
        // by the 2.5s throttle it would otherwise land inside.
        lastMintAtRef.current = 0;
        window.setTimeout(() => { void createOrderAndIntents(opts); }, 0);
      } else {
        remintAfterCurrentOrderRef.current = false;
      }
    });


    return createOrderPromiseRef.current;
  };

  // Auto-advance to payment options once the address is complete — the
  // shopper sees UPI/Cards/COD tiles inline on the same page (no explicit
  // "Continue" tap needed). Guarded by a ref so it only fires once per fill.
  //
  // IMPORTANT: wait for paymentConfig to load before creating the order.
  // Otherwise `hasOnline` is false → `hasPartial` is false → effectiveMode
  // stamps as "full" even though the shopper defaults to Partial, and the
  // gateway later charges the full total instead of the ₹100 advance.
  useEffect(() => {
    if (showPayment || creatingOrder) return;
    if (!paymentConfigLoaded) return;
    if (autoAdvancedRef.current) return;
    // PAYMENT-FIRST: reveal the payment tiles as soon as the phone gate
    // clears, even if the address is still blank. Tiles remain interactive;
    // tapping any without an address opens the address sheet via
    // requireAddressOrPrompt(). Intents mint themselves later, once the
    // address is filled (see the effect below).
    if (!phoneValid) return;
    autoAdvancedRef.current = true;
    setShowPayment(true);
    const filled = addressComplete;
    if (filled) void createOrderAndIntents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phoneValid, pincode, streetAddress, city, state, fullName, showPayment, creatingOrder, paymentConfigLoaded]);

  // When the address gets filled *after* showPayment has been revealed
  // (payment-first flow), mint the UPI intents so the tiles activate.
  const intentsMintedForAddressRef = useRef(false);
  useEffect(() => {
    if (!showPayment) return;
    if (!paymentConfigLoaded) return;
    const filled = addressComplete;
    if (!filled) return;
    if (intentsMintedForAddressRef.current) return;
    if (orderId) return; // createOrderAndIntents already ran (auto-advance branch)
    intentsMintedForAddressRef.current = true;
    void createOrderAndIntents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPayment, paymentConfigLoaded, pincode, streetAddress, city, state, fullName, orderId]);


  // Desktop QR has been removed — desktop shoppers now pay via the hosted
  // gateway (PayU / Cashfree / Razorpay) directly. This ref is kept only so
  // the snapshot-reset effects below compile without changes.
  const desktopQrPollStartedRef = useRef(false);

  // Any payable-amount change after an order is minted must re-mint the order +
  // UPI intent. This covers Partial ↔ Full, late paymentConfig load, coupon
  // apply/remove, free-shipping threshold flips, and cart quantity changes.
  // Gateway functions use DB-authoritative order totals, so stale order rows are
  // the #1 source of "checkout shows X, PhonePe/Razorpay shows Y" mismatches.
  useEffect(() => {
    if (lastPaymentSnapshotRef.current === paymentSnapshot) return;
    if (!orderId && !showPayment) {
      lastPaymentSnapshotRef.current = paymentSnapshot;
      return; // nothing to reset yet
    }
    if (confirmingPayment || orderPlaced) return; // don't disrupt an in-flight confirm
    // Desktop QR auto-polls (sets waiting=true) the moment a QR is ready. A
    // Partial↔Full toggle after that must still re-mint — cancel the passive
    // QR wait so the effect can rebuild an order for the new amount. A real
    // UPI-app tap (waitingApp !== "UPI QR") should not be interrupted.
    const isDesktopQrWait = waiting && waitingApp === "UPI QR" && !isMobile();
    if (waiting && !isDesktopQrWait) return;
    // Only consume the change once it is safe to rebuild. If an amount changes
    // while a payment app/confirmation is active, keeping the old marker makes
    // this effect retry as soon as that wait ends instead of silently losing it.
    lastPaymentSnapshotRef.current = paymentSnapshot;
    if (isDesktopQrWait) {
      clearWaiting();
      setWaiting(false);
      try { window.dispatchEvent(new Event("payment-ended")); } catch { /* noop */ }
      desktopQrPollStartedRef.current = false;
    }
    // Invalidate local gateway intents only. Keep checkout_token stable so the
    // backend updates the existing pending row instead of creating duplicates.
    orderIdRef.current = null;
    orderNumberRef.current = null;
    orderSnapshotRef.current = null;
    setOrderId(null);
    setOrderNumber(null);
    setPendingOrder(null);
    setPaymentFailed(false);
    // Mark as loading (not idle) so the UPI tiles show a spinner instead of
    // rendering as permanently-disabled faded buttons while the remint runs.
    setIntents({
      gpay: { status: "loading" }, phonepe: { status: "loading" },
      paytm: { status: "loading" }, bhim: { status: "loading" }, any: { status: "loading" },
    });
    gatewayRef.current = {};
    autoAdvancedRef.current = false;
    desktopQrPollStartedRef.current = false;
    if (showPayment) {
      queueMicrotask(() => { void createOrderAndIntents(); });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentSnapshot, orderId, showPayment, confirmingPayment, orderPlaced, waiting, waitingApp]);

  // Safety-net: if any ready intent's stamped amount no longer matches the
  // current chargeAmount (e.g. the snapshot reset effect bailed out because
  // `waiting` was briefly true), automatically re-mint. This guarantees a
  // shopper who switched Partial↔Full can never launch a stale UPI URL.
  useEffect(() => {
    if (!showPayment) return;
    if (confirmingPayment || orderPlaced) return;
    if (creatingOrder) return;
    // Desktop QR passive wait shouldn't block a re-mint (see snapshot effect above).
    const isDesktopQrWait = waiting && waitingApp === "UPI QR" && !isMobile();
    if (waiting && !isDesktopQrWait) return;
    // Tolerance: only treat as stale if the difference is ≥ 1 rupee. Sub-rupee
    // rounding noise between the stamped `requestedAmount` and the recomputed
    // `chargeAmount` (late paymentConfig, discount recompute, etc.) used to
    // ping-pong the mint effect forever — 437 place-order retries in one
    // session in prod. 1 rupee is well below any legitimate plan change.
    const anyStale = (Object.keys(intents) as UpiApp[]).some((k) => {
      const s = intents[k];
      return s.status === "ready" && typeof s.amount === "number"
        && Math.abs(Math.round(s.amount * 100) - Math.round(chargeAmount * 100)) >= 100;
    });
    if (!anyStale) return;
    if (isDesktopQrWait) {
      clearWaiting();
      setWaiting(false);
      try { window.dispatchEvent(new Event("payment-ended")); } catch { /* noop */ }
      desktopQrPollStartedRef.current = false;
    }
    // Same local cleanup as the snapshot-reset effect above. Keep the token
    // stable so place-order updates one pending row.
    orderIdRef.current = null;
    orderNumberRef.current = null;
    orderSnapshotRef.current = null;
    setOrderId(null);
    setOrderNumber(null);
    setIntents({
      gpay: { status: "loading" }, phonepe: { status: "loading" },
      paytm: { status: "loading" }, bhim: { status: "loading" }, any: { status: "loading" },
    });
    queueMicrotask(() => { void createOrderAndIntents(); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intents, chargeAmount, showPayment, waiting, confirmingPayment, orderPlaced, creatingOrder]);


  // ─── Full gateway modal paths (Razorpay / Cashfree / PayU) ──────────────
  const openRazorpay = async (order: PendingOrder) => {
    setConfirmingPayment(false);
    const [loaded, rzpData] = await Promise.all([
      loadRazorpayScript(),
      callEdgeFunction("razorpay-order", {
        store_id: store.id, amount: chargeAmount, currency, order_id: order.id,
      }, 15000),
    ]);
    if (!loaded) throw new Error("Failed to load payment gateway");
    gatewayRef.current = { pg: "razorpay" };

    const contactDigits = normalizePhone(phone).replace(/\D/g, "");
    const razorpayContact = contactDigits.length === 12 && contactDigits.startsWith("91") ? contactDigits.slice(2) : contactDigits;

    const handlePaymentSuccess = async (response: any) => {
      setConfirmingPayment(true);
      try {
        try {
          await callEdgeFunction("razorpay-verify", { ...response, order_id: order.id, store_id: store.id }, 15000);
        } catch (verifyErr) {
          console.warn("Razorpay verify failed, trying status fallback:", verifyErr);
          const statusData = await callEdgeFunction("razorpay-payment-status", {
            razorpay_payment_id: response.razorpay_payment_id, store_id: store.id, order_id: order.id,
          }, 10000);
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
            }, 10000);
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
    let cashfreeReturnUrl: string;
    try {
      const returnUrl = new URL(buildPaymentReturnUrl());
      returnUrl.searchParams.set("cf_order", "{order_id}");
      returnUrl.searchParams.set("order", order.id);
      cashfreeReturnUrl = returnUrl.toString();
    } catch {
      cashfreeReturnUrl = `${window.location.origin}/checkout?cf_order={order_id}&order=${order.id}`;
    }
    const [cashfree, cfData] = await Promise.all([
      Promise.race([
        loadCashfree(env),
        new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error("Cashfree took too long to open")), 12000)),
      ]),
      callEdgeFunction("store-cashfree-create-order", {
        store_id: store.id, amount: chargeAmount, currency, order_id: order.id,
        customer_name: fullName, customer_phone: toCanonicalIndianPhone(phone) || normalizePhone(phone), customer_email: email || undefined,
        return_url: cashfreeReturnUrl,
      }, 15000),
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
          }, 10000);
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
      }, 15000);
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
    try {
      const pendingPayload = JSON.stringify({
        order_id: order.id, order_number: order.number,
        txnid: payuData.txnid, is_partial: isPartialOrder,
        charge_amount: chargeAmount, total, ts: Date.now(),
      });
      sessionStorage.setItem(`payu_pending_${store.id}`, pendingPayload);
      localStorage.setItem(`payu_pending_${store.id}`, pendingPayload);
    } catch { /* noop */ }
    // Persist the same canonical recovery state used by every other UPI flow.
    // This must happen before Bolt opens an external app because Android/IABB
    // may destroy and recreate the checkout document during the handoff.
    persistWaiting("any", "PayU", { orderId: order.id, orderNumber: order.number });

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
          }, 10000);
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
      const bolt = await Promise.race([
        loadPayuBolt(payuData.env === "sandbox" ? "sandbox" : "production"),
        new Promise<never>((_, reject) => {
          window.setTimeout(() => reject(new Error("PayU took too long to open")), 12000);
        }),
      ]);

      await new Promise<void>((resolve) => {
        let settled = false;
        let timeoutId: number | null = null;
        let returnedCheckId: number | null = null;
        let leftCheckoutTab = false;
        const done = () => {
          if (timeoutId != null) window.clearTimeout(timeoutId);
          if (returnedCheckId != null) window.clearTimeout(returnedCheckId);
          document.removeEventListener("visibilitychange", handleVisibilityReturn);
          window.removeEventListener("pageshow", handleBfcacheReturn);

          resolve();
        };
        const continueUnifiedVerification = () => {
          settled = true;
          setConfirmingPayment(false);
          setOrderId(order.id);
          setOrderNumber(order.number);
          setShowPayment(true);
          setWaitingApp("PayU");
          setPaymentFailed(false);
          setPendingOrder(null);
          setWaiting(true);
          done();
        };
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
            continueUnifiedVerification();
            return;
          }
          done();
        };
        const handleVisibilityReturn = () => {
          if (document.visibilityState === "hidden") { leftCheckoutTab = true; return; }
          if (!leftCheckoutTab || settled) return;
          if (returnedCheckId != null) window.clearTimeout(returnedCheckId);
          returnedCheckId = window.setTimeout(async () => {
            if (settled) return;
            const confirmed = await verifyAndFinalize({ attempts: 1, intervalMs: 0, showConfirming: false });
            if (confirmed) { settled = true; done(); return; }
            // PayU commonly needs 15–45s to reflect a successful UPI payment.
            // A single check 900ms after app return is not a failure verdict.
            // Keep the durable recovery record and hand off to the unified 90s
            // poller so the shopper sees processing → confirmation, even when
            // the browser document was refreshed during the UPI round trip.
            continueUnifiedVerification();
          }, 1200);
        };
        // iOS bfcache restore after the Bolt/UPI hop — see the poller above.
        const handleBfcacheReturn = () => {
          if (settled) return;
          leftCheckoutTab = true;
          handleVisibilityReturn();
        };
        window.addEventListener("pageshow", handleBfcacheReturn);
        document.addEventListener("visibilitychange", handleVisibilityReturn);

        timeoutId = window.setTimeout(async () => {
          if (settled) return;
          const confirmed = await verifyAndFinalize({ attempts: 1, intervalMs: 0, showConfirming: false });
          if (confirmed) { settled = true; done(); return; }
          continueUnifiedVerification();
        }, 30000);
        const isCancelStatus = (s: string) =>
          s === "cancel" || s === "cancelled" || s === "canceled" ||
          s === "usercancelled" || s === "user_cancelled" ||
          s === "closed" || s === "closedbyuser" || s === "dropped" ||
          s === "bolt_closed" || s === "userclosed";
        // Stamp PayU only once the SDK is ready to launch. If loading fails,
        // recovery must not poll a transaction that never reached PayU.
        gatewayRef.current = { pg: "payu", payu_txnid: payuData.txnid };
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
      try { sessionStorage.removeItem(`payu_pending_${store.id}`); localStorage.removeItem(`payu_pending_${store.id}`); } catch { /* noop */ }
      clearWaiting();
      gatewayRef.current = {};
      setWaiting(false);
      setPendingOrder(order); setPaymentFailed(true);
      toast.error("PayU checkout could not open. Please retry.");
    }
  };

  // ─── "Pay with card/wallet" (opens active gateway modal) ────────────────
  const [openingGateway, setOpeningGateway] = useState(false);
  const startGatewayPayment = async () => {
    if (openingGateway || creatingOrder || couponLoading || paymentAmountSyncing) return;
    // PAYMENT-FIRST address gate — same as UPI tap.
    if (!requireAddressOrPrompt(() => { void startGatewayPayment(); })) return;
    // Hard validation too: in-app browsers (Instagram/WhatsApp) can recreate
    // the tab and wipe the form while the gate bypass is armed, which used to
    // mint a paid order with a blank name/address.
    const addrErr = validateAddress();
    if (addrErr) {
      toast.error(addrErr);
      setAddressSheetDismissed(false);
      setShowAddressFormSheet(true);
      return;
    }

    if (!activeGateway) {
      toast.error("No online payment gateway configured");
      return;
    }
    setOpeningGateway(true);
    try {
      const order = await createOrderIfNeeded(activeGateway, { userInitiated: true });
      setShowPayment(true);
      try { fireStorefrontEvent({ storeId: store.id, eventName: "pay_click" as any, metadata: { method: activeGateway, dev: deviceTag() } as any }); } catch { /* noop */ }
      if (activeGateway === "razorpay") await openRazorpay(order);
      else if (activeGateway === "cashfree") await openCashfree(order);
      else await openPayu(order);
    } catch (e: any) {
      toast.error(e?.message || "Could not start payment");
    } finally {
      setOpeningGateway(false);
    }
  };

  const handleRetryPayment = async () => {
    if (!pendingOrder) return;
    // NEVER start a second charge before re-checking the first one. A late
    // bank/gateway confirmation (very common on UPI) can land after we've
    // already shown the retry screen — retrying blindly charges the shopper
    // twice for the same order.
    try {
      const gatewayResult = await forceGatewayVerify();
      if (normalizeGatewayResult(gatewayResult) === "success") { finishSuccess(pendingOrder.id); return; }
      const { data } = await supabase.functions.invoke("order-payment-status", {
        body: { store_id: store.id, order_id: pendingOrder.id },
      });
      if ((data as any)?.payment_status === "success") { finishSuccess(pendingOrder.id); return; }
    } catch { /* fall through to a real retry */ }
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
  // React state does not update synchronously. Two taps in the same frame can
  // both observe placingCod=false, so use a ref as the authoritative lock.
  const placingCodRef = useRef(false);
  // Confirm-before-place popup, standalone COD only (never the partial flow).
  const [codConfirmOpen, setCodConfirmOpen] = useState(false);
  const placeCod = async () => {
    if (placingCodRef.current || placingCod || creatingOrder || couponLoading || paymentAmountSyncing) return;
    // Partial-payment stores collect the configured advance online and only
    // the remaining balance on delivery. Never allow a separate zero-advance
    // COD path, including from a stale tab that rendered older checkout code.
    if (partialConfigured && hasOnline) {
      toast.error("Please pay the advance to place this order");
      return;
    }
    // PAYMENT-FIRST address gate — open sheet + remember the COD tap so it
    // auto-resumes after the shopper saves.
    if (!requireAddressOrPrompt(() => { void placeCod(); })) return;
    const err = validateAddress();
    if (err) { toast.error(err); return; }
    // Acquire before the first await so a double tap cannot start a second
    // create/finalize chain while React is still committing `placingCod`.
    placingCodRef.current = true;
    setPlacingCod(true);
    try {
      saveExpressInfo();
      const order = await createOrderIfNeeded("cod", { userInitiated: true });
      const { data, error } = await Promise.race([
        supabase.functions.invoke("checkout-v2-cod", {
          body: { store_id: store.id, order_id: order.id },
        }),
        new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error("Order placement took too long. Please retry.")), 15000)),
      ]);
      if (error) throw new Error(error.message);
      const res = data as { ok?: boolean; error?: string } | null;
      if (!res?.ok) throw new Error(res?.error || "Failed to place COD order");
      fireInitiateCheckoutOnce();
      fireAddPaymentInfoOnce("cod", total);
      finishSuccess(order.id);
    } catch (e: any) {
      // A stale duplicate invocation arriving after success is benign and must
      // never replace the confirmation screen with an error.
      if (e?.message !== "checkout_already_completed") {
        toast.error(e.message || "Failed to place COD order");
      }
    } finally {
      placingCodRef.current = false;
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

  // ─── Sold-out guard ─────────────────────────────────────────────────────
  // Direct-URL /checkout?product=… must not let shoppers buy a sold-out item.
  // Server also enforces this in place-order, but blocking here saves them
  // filling in the address form only to see "Out of stock" on submit.
  {
    const outOfStockItem = (() => {
      if (isSingleMode && buyNowProduct) {
        const variantStock = (buyNowVariant as any)?.stock_quantity;
        const productStock = (buyNowProduct as any)?.stock_quantity;
        const stock = buyNowVariant ? variantStock : productStock;
        if (stock != null && Number(stock) <= 0) return buyNowProduct.name as string;
      }
      return null;
    })();
    if (outOfStockItem) {
      return (
        <div className="mx-auto max-w-md p-6 text-center space-y-4">
          <h1 className="text-xl font-bold text-foreground">
            {tCritical("Sold out", "स्टॉक ख़त्म")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {tCritical(
              `“${outOfStockItem}” is currently out of stock. Please try another item.`,
              `“${outOfStockItem}” अभी उपलब्ध नहीं है। कृपया कोई दूसरा प्रोडक्ट चुनें।`,
            )}
          </p>
          <Button className="w-full" onClick={() => navigate(storefrontPath(store?.slug || ""))}>
            {tCritical("Back to shop", "दुकान पर वापस")}
          </Button>
        </div>
      );
    }
  }

  // ─── Store support bar (logo • name • customer-care number) ─────────────
  // Same treatment as the checkout header so shoppers always have the store
  // owner's number in reach on the waiting + confirmation screens.
  const supportPhone = String((store as any)?.secondary_phone || (store as any)?.whatsapp_number || "").trim();
  const storeSupportBar = (
    <div className="sticky top-0 z-20 -mx-4 mb-4 flex items-center gap-2 border-b border-[#ECECEC] bg-white px-3 py-1.5">
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        {store?.logo_url ? (
          <img src={store.logo_url} alt={store.name || "Store logo"} className="h-8 w-auto max-w-[120px] self-start object-contain" />
        ) : (
          <div className="truncate text-[15px] font-bold leading-tight">{store?.name || "Store"}</div>
        )}
        {supportPhone ? (
          <a
            href={`tel:${supportPhone.replace(/\s/g, "")}`}
            className="mt-0.5 inline-flex items-center gap-1 text-[11px] leading-none text-muted-foreground transition-colors hover:text-foreground"
            aria-label={`Customer care ${supportPhone}`}
          >
            <Headset className="h-3 w-3" />
            <span className="truncate">{supportPhone}</span>
          </a>
        ) : null}
      </div>

      {supportPhone ? (
        <a
          href={`tel:${supportPhone.replace(/\s/g, "")}`}
          className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700"
        >
          Need help?
        </a>
      ) : null}
    </div>
  );


  // ─── Thank-you screen ───────────────────────────────────────────────────
  if (orderPlaced) {
    // `total` is BEFORE the prepaid discount. What the customer is actually
    // charged is `prepaidTotal` on full prepaid orders (prepaid discount applied)
    // and `total` for partial/COD orders.
    const tyPrepaidDiscount = isPartialOrder ? 0 : Math.max(0, total - prepaidTotal);
    const grandTotal = Math.max(0, isPartialOrder ? total : prepaidTotal);
    const codDue = isPartialOrder ? balanceDue : (lastPaidMethodRef.current === "cod" ? grandTotal : 0);
    const paidNow = isPartialOrder ? advancePaid : (lastPaidMethodRef.current === "cod" ? 0 : grandTotal);
    const tyCharges = (taxInclusive ? 0 : taxAmount) + shippingCharge;
    const addressLine = [streetAddress, apartment, city, state, pincode].filter(Boolean).join(", ");
    const previewItems = checkoutItems.slice(0, 3);
    const extraItems = checkoutItems.length - previewItems.length;

    return (
      <div className="mx-auto max-w-lg px-4 pt-3 pb-12">
        {storeSupportBar}
        {/* Hero */}
        <div className="text-center">
          <div className="relative mx-auto mb-4 h-20 w-20">
            <span className="absolute inset-0 rounded-full bg-emerald-500/15 animate-ping" aria-hidden="true" />
            <span className="absolute inset-0 rounded-full bg-emerald-500/10" aria-hidden="true" />
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/30">
              <Check className="h-9 w-9" strokeWidth={3} />
            </span>
          </div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-foreground">Order confirmed</h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground text-pretty">
            Thanks{fullName ? `, ${fullName.split(" ")[0]}` : ""}! We've received your order and the store will process it shortly.
          </p>
          {(orderNumber || orderId) && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1.5">
              <Package className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[12px] text-muted-foreground">Order</span>
              <span className="font-mono text-[12px] font-bold text-foreground">
                {orderNumber && Number.isFinite(Number(orderNumber))
                  ? `#${1000 + Number(orderNumber)}`
                  : orderNumber
                    ? `#${orderNumber}`
                    : `#${orderId?.slice(0, 8).toUpperCase()}`}
              </span>
            </div>
          )}
        </div>

        {/* Items */}
        {previewItems.length > 0 && (
          <div className="mt-6 rounded-2xl border bg-card p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {checkoutItems.length} {checkoutItems.length === 1 ? "item" : "items"} in this order
            </div>
            <div className="mt-3 space-y-3">
              {previewItems.map((it, idx) => (
                <div key={`${it.productId}-${it.variantId || idx}`} className="flex items-center gap-3">
                  {it.image ? (
                    <img src={it.image} alt={it.name} loading="lazy" className="h-12 w-12 shrink-0 rounded-lg border object-cover" />
                  ) : (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border">
                      <Package className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-[13px] font-medium text-foreground">{it.name}</p>
                    <p className="text-[12px] text-muted-foreground">Qty {it.quantity}</p>
                  </div>
                  <span className="text-[13px] font-semibold tabular-nums text-foreground">
                    {formatPrice(it.price * it.quantity, currency)}
                  </span>
                </div>
              ))}
              {extraItems > 0 && (
                <p className="text-[12px] text-muted-foreground">+ {extraItems} more item{extraItems > 1 ? "s" : ""}</p>
              )}
            </div>
          </div>
        )}

        {/* Payment summary */}
        <div className="mt-4 rounded-2xl border bg-card p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Payment</div>
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-muted-foreground">Items subtotal</span>
              <span className="tabular-nums text-foreground">{formatPrice(subtotal, currency)}</span>
            </div>
            {couponDiscount > 0 && (
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-muted-foreground">Coupon discount</span>
                <span className="tabular-nums text-emerald-600">− {formatPrice(couponDiscount, currency)}</span>
              </div>
            )}
            {tyPrepaidDiscount > 0 && (
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-muted-foreground">Prepaid discount</span>
                <span className="tabular-nums text-emerald-600">− {formatPrice(tyPrepaidDiscount, currency)}</span>
              </div>
            )}
            {tyCharges > 0 && (
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-muted-foreground">Shipping &amp; charges</span>
                <span className="tabular-nums text-foreground">{formatPrice(tyCharges, currency)}</span>
              </div>
            )}
            <div className="flex items-center justify-between border-t pt-2 text-[13px]">
              <span className="font-semibold text-foreground">Order total</span>
              <span className="font-semibold tabular-nums text-foreground">{formatPrice(grandTotal, currency)}</span>
            </div>

            {paidNow > 0 && (
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-muted-foreground">{isPartialOrder ? "Advance paid" : "Paid online"}</span>
                <span className="font-semibold tabular-nums text-emerald-600">{formatPrice(paidNow, currency)}</span>
              </div>
            )}
            {codDue > 0 && (
              <div className="flex items-center justify-between rounded-xl bg-muted/60 px-3 py-2 text-[13px]">
                <span className="flex items-center gap-1.5 font-medium text-foreground">
                  <Banknote className="h-4 w-4 text-muted-foreground" /> Pay on delivery
                </span>
                <span className="font-extrabold tabular-nums text-foreground">{formatPrice(codDue, currency)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Primary action — inline, always visible without scrolling to the bottom */}
        <div className="mt-4">
          <Button
            onClick={handleViewMyOrders}
            disabled={viewingOrders}
            className="h-12 w-full rounded-xl text-[15px] font-bold active:scale-[0.98] transition-transform"
          >
            {viewingOrders && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            View my order
          </Button>
        </div>


        {/* Delivery */}
        {(addressLine || phone) && (
          <div className="mt-4 rounded-2xl border bg-card p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Delivery details</div>
            {addressLine && (
              <div className="mt-3 flex items-start gap-2.5">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <p className="text-[13px] leading-relaxed text-foreground">
                  {fullName && <span className="font-semibold">{fullName}<br /></span>}
                  {addressLine}
                </p>
              </div>
            )}
            {(phone || email) && (
              <div className="mt-3 flex items-start gap-2.5 border-t pt-3">
                <Truck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <p className="text-[12px] leading-relaxed text-muted-foreground">
                  Order updates will be sent to <strong className="text-foreground">{phone}</strong>
                  {email ? <> and <strong className="text-foreground">{email}</strong></> : null}.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Secondary action */}
        <div className="mt-4">
          <Button
            variant="outline"
            onClick={() => navigate(storefrontPath(store.slug))}
            className="h-12 w-full rounded-xl text-[15px] font-semibold active:scale-[0.98] transition-transform"
          >
            Continue shopping
          </Button>
        </div>



        <div className="mt-4 flex items-center justify-center gap-1.5 text-[12px] text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
          Secure checkout · Need help? Contact the store on WhatsApp
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



  const hasPendingPaymentReturn = (() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.has("cf_order")
        || params.has("payu_order")
        || Boolean(sessionStorage.getItem(WAIT_KEY) || localStorage.getItem(WAIT_KEY))
        || Boolean(
          store?.id && (
            sessionStorage.getItem(`payu_pending_${store.id}`)
            || localStorage.getItem(`payu_pending_${store.id}`)
          ),
        );
    } catch {
      return false;
    }
  })();

  if (checkoutItems.length === 0 && !orderId && !isSingleMode && !hasPendingPaymentReturn) {
    // Cart is empty (e.g. shopper removed the last item on the phone step) —
    // send them straight back to the storefront home rather than a dead end.
    navigate(storefrontPath(store.slug), { replace: true });
    return null;
  }



  // ─── Waiting screen (UPI intent flow) — mobile only ─────────────────────
  // On desktop we keep the QR inline (see the desktop UPI QR card below) and
  // just show a small "waiting" strip there, so the shopper can still see the
  // QR code while completing payment in their phone's UPI app.
  if (waiting && isMobile()) {
    return (
      <div className="mx-auto max-w-md min-h-screen bg-[#F5F5F5] px-4 pt-3 pb-10">
        {storeSupportBar}
        {/* Status card */}
        <div className="rounded-2xl bg-white shadow-[0_8px_30px_-12px_rgba(0,0,0,0.18)] p-6 text-center animate-fade-in">
          <div className="relative mx-auto mb-5 h-20 w-20">
            <span className="absolute inset-0 rounded-full bg-primary/10 animate-ping" aria-hidden="true" />
            <span className="absolute inset-0 rounded-full bg-primary/10" aria-hidden="true" />
            <span className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-9 w-9 text-primary animate-spin" />
            </span>
          </div>

          <h1 className="text-[19px] font-bold tracking-tight text-foreground text-balance">
            Complete payment in {waitingApp}
          </h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground text-pretty">
            Approve the request to confirm your order.
          </p>

          <div className="mt-5 rounded-xl bg-[#F7F8FA] px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Amount to pay</div>
            <div className="text-2xl font-extrabold tabular-nums text-foreground">{formatPrice(chargeAmount, currency)}</div>
          </div>

          {/* Progress steps */}
          <div className="mt-5 space-y-2.5 text-left">
            {[
              { label: "Order created", done: true },
              { label: `Opened ${waitingApp}`, done: true },
              { label: "Waiting for your approval", done: false },
              { label: "Order confirmed", done: false },
            ].map((step) => (
              <div key={step.label} className="flex items-center gap-2.5">
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                    step.done ? "bg-emerald-500 text-white" : "border-2 border-dashed border-muted-foreground/30"
                  }`}
                >
                  {step.done ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
                </span>
                <span className={`text-[13px] ${step.done ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Reassurance */}
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-100 bg-emerald-50/70 px-3.5 py-3 text-left">
          <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0 text-emerald-600" />
          <p className="text-[12px] leading-relaxed text-emerald-900">
            100% secure payment. Please keep this page open — we confirm your order automatically once the payment is approved.
          </p>
        </div>

        <Button
          variant="outline"
          className="mt-5 w-full h-12 rounded-xl font-semibold active:scale-[0.98] transition-transform"
          onClick={forceRecheck}
          disabled={manualChecking}
        >
          {manualChecking ? (
            <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Checking…</span>
          ) : (
            "I've paid — check now"
          )}
        </Button>

        <button className="mt-4 w-full text-center text-xs font-medium text-muted-foreground underline underline-offset-2" onClick={() => {
          clearWaiting(); setWaiting(false); setConfirmingPayment(false);
          try { window.dispatchEvent(new Event("payment-ended")); } catch { /* noop */ }
          // The intent URL carries a single gateway payment reference. Once the
          // shopper cancelled inside GPay/PhonePe that reference is burnt — a
          // second app tap on the same URL fails ("transaction already
          // processed"). Mint a fresh intent on the SAME order (checkout_token
          // keeps it one pending row) so the next app opens cleanly.
          mintCountRef.current = 0;
          mintLoopBlockedRef.current = false;
          lastMintAtRef.current = 0;
          setIntents({
            gpay: { status: "loading" }, phonepe: { status: "loading" },
            paytm: { status: "loading" }, bhim: { status: "loading" }, any: { status: "loading" },
          });
          queueMicrotask(() => { void createOrderAndIntents(); });
        }}>
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
  if (needsPhone) {
    return (
      <>
        <Suspense fallback={<div className="min-h-[70vh]" />}>
          <CheckoutPhoneStep
            storeId={store?.id}
            storeSlug={store?.slug}
            storeName={store?.name}
            storeLogo={store?.logo_url}
            storePhone={(store as any)?.secondary_phone || (store as any)?.whatsapp_number || null}
            cartItems={checkoutItems as any}
            isSingleMode={isSingleMode}
            onBack={goBack}
            onQuantityChange={(item, nextQty) => {
              if (isSingleMode) setBuyNowQty(nextQty);
              else updateQuantity(item.productId, item.variantId, nextQty);
            }}
            onRemoveItem={(item) => {
              if (isSingleMode) {
                // Buy-now has no cart to fall back to — go straight home.
                navigate(storefrontPath(store?.slug || ""), { replace: true });
                return;
              }
              removeFromCart(item.productId, item.variantId);
              // If that was the last item, the empty-cart guard above will
              // redirect to the storefront home on the next render.
            }}
            onComplete={(p, savedAddress) => {
              setPhone(p);
              try { localStorage.setItem("checkout_phone", toCanonicalIndianPhone(p) || p); } catch { /* noop */ }
              if (savedAddress) applyPhoneLookupAddress(savedAddress);
            }}
          />
        </Suspense>
        {exitOfferDialog}
      </>
    );
  }

  // ─── Main layout ────────────────────────────────────────────────────────
  const mobile = isMobile();

  const savedAddr = savedAddresses?.find((a: any) => a.id === selectedAddressId);
  const addressFilled = !!(pincode && isCompleteStreetAddress(streetAddress) && city && state && fullName);
  // One source of truth for discounts shown in the header:
  //   • coupon always counts (applies to both plans)
  //   • prepaid discount counts only when the shopper is on "Pay full"
  // Keeps the "₹X saved so far" chip accurate as the shopper toggles plans.
  const savedAmount =
    (couponDiscount > 0 ? couponDiscount : 0) +
    (!isPartialOrder && prepaidDiscount > 0 ? prepaidDiscount : 0);
  // Fixed anchor = the cart's value BEFORE any discount, matching the
  // Order Summary line items + shipping + tax. Prevents the strike-through
  // total from jumping when the shopper toggles Partial↔Full.
  const originalTotal = Math.max(
    0,
    subtotal + (taxInclusive ? 0 : taxAmount) + shippingCharge,
  );
  const finalTotal = isPartialOrder ? total : prepaidTotal;

  return (
    <div
      className="mx-auto max-w-md min-h-screen bg-[#F5F5F5] pb-28 text-[13px]"
      style={{ fontFamily: "'Montserrat Alternates', system-ui, -apple-system, 'Segoe UI', sans-serif" }}
    >

      {/* Confirming payment overlay */}
      {confirmingPayment && (
        <div className="fixed inset-0 z-50 bg-background/85 backdrop-blur-sm flex items-center justify-center">
          <div className="text-center p-6 max-w-xs">
            <Loader2 className="h-10 w-10 text-primary animate-spin mx-auto mb-4" />
            <h3 className="font-semibold mb-1">Confirming your payment…</h3>
            <p className="text-xs text-muted-foreground">Please don't close this page. It can take up to 20 seconds.</p>
          </div>
        </div>
      )}

      {/* Header: back • brand + customer care • trust badges */}
      <div className="sticky top-0 z-20 bg-white border-b border-[#ECECEC] px-3 py-2 flex items-center gap-2">
        <button onClick={goBack} aria-label="Back" className="p-1 -ml-1 shrink-0">
          <ArrowLeft className="h-4.5 w-4.5" />
        </button>

        <div className="flex flex-col justify-center min-w-0 flex-1">

          {store?.logo_url ? (
            <img src={store.logo_url} alt={store.name || "Store logo"} className="h-7 w-auto max-w-[112px] self-start object-contain" />
          ) : (
            <div className="text-[15px] font-bold leading-tight truncate">{store?.name || "Store"}</div>
          )}
          {(store?.secondary_phone || store?.whatsapp_number) && (
            <a
              href={`tel:${(store?.secondary_phone || store?.whatsapp_number || "").replace(/\s/g, "")}`}
              className="inline-flex items-center gap-1 text-[10px] leading-none text-muted-foreground hover:text-foreground transition-colors"
              aria-label={`Customer care ${store?.secondary_phone || store?.whatsapp_number}`}
            >
              <Headset className="h-3 w-3" />
              <span className="truncate">{store?.secondary_phone || store?.whatsapp_number}</span>
            </a>
          )}
        </div>


        <div className="flex items-center">
          <img
            src={secureBadge.url}
            alt="100% Secure Payment"
            width={110}
            height={50}
            decoding="async"
            className="h-[28px] w-auto shrink-0 object-contain"
          />
        </div>
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
        <div className="px-3 py-2.5 space-y-2">

          {/* Order Summary card — header opens a bottom sheet (parity w/ address sheet) */}
          <div className="bg-white rounded-lg border border-[#ECECEC] px-3 py-2.5">
            <button
              type="button"
              onClick={() => setSummaryOpen(true)}
              className="w-full flex items-center gap-2.5 text-left"
              aria-haspopup="dialog"
              aria-expanded={summaryOpen}
            >
              <div className="h-8 w-8 rounded-md bg-[#F5F5F5] flex items-center justify-center flex-shrink-0">
                <ShoppingCart className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-bold leading-tight">Order Summary</div>
                {savedAmount > 0 && (
                  <div className="text-[10px] text-emerald-700 font-semibold leading-tight mt-0.5">
                    {formatPrice(savedAmount, currency)} saved
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className="text-[10px] text-muted-foreground leading-tight">{checkoutItems.length} item{checkoutItems.length !== 1 ? "s" : ""}</div>
                <div className="flex items-center gap-1 justify-end">
                  {savedAmount > 0 && originalTotal > finalTotal && (
                    <span className="text-[10px] text-muted-foreground line-through">{formatPrice(originalTotal, currency)}</span>
                  )}
                  <span className="text-[13px] font-bold">{formatPrice(finalTotal, currency)}</span>
                  <ChevronDown className="h-3.5 w-3.5" />
                </div>
              </div>
            </button>
          </div>

          {/* Social proof — visible as soon as the phone step clears, even before address */}
          {reviewsTeaserReady && (
            <Suspense fallback={null}>
              <CheckoutReviewsTeaser storeId={store?.id} />
            </Suspense>
          )}

          {/* Order Summary bottom sheet */}
          {summaryOpen && typeof document !== "undefined" && createPortal(
            <div className="fixed inset-0 z-[100] flex flex-col justify-end pointer-events-auto" role="dialog" aria-modal="true" aria-label="Order summary">
              <div className="absolute inset-0 bg-black/50" onClick={() => setSummaryOpen(false)} aria-hidden />
              <div className="relative mx-auto w-full max-w-md bg-white rounded-t-2xl flex flex-col overflow-hidden max-h-[85dvh]">
                <div className="px-5 py-3 flex items-center justify-between border-b border-[#ECECEC] flex-shrink-0">
                  <div className="text-[16px] font-bold">Order Summary</div>
                  <button
                    type="button"
                    onClick={() => setSummaryOpen(false)}
                    aria-label="Close"
                    className="h-9 w-9 -mr-2 rounded-full flex items-center justify-center hover:bg-black/5 active:bg-black/10"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-3 pb-4 space-y-3">
                  {checkoutItems.map((it, idx) => {
                    const qty = it.quantity || 1;
                    const setQty = (next: number) => {
                      const n = Math.max(1, Math.min(99, Math.floor(next)));
                      if (isSingleMode) setBuyNowQty(n);
                      else updateQuantity(it.productId, it.variantId, n);
                    };
                    const canRemove = !isSingleMode;
                    return (
                    <div key={`${it.productId}-${it.variantId || ""}-${idx}`} className="flex items-start gap-3">
                      <CheckoutItemImage
                        image={(it as any).image}
                        name={it.name || "Item"}
                        meta={(it as any).meta}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="line-clamp-2 text-[13px] font-semibold">{it.name || "Item"}</div>
                        <div className="mt-1.5 inline-flex items-center gap-1 rounded-md border border-[#ECECEC] bg-white">
                          <button
                            type="button"
                            onClick={() => setQty(qty - 1)}
                            disabled={qty <= 1}
                            aria-label="Decrease quantity"
                            className="h-7 w-7 flex items-center justify-center text-muted-foreground disabled:opacity-40 active:bg-[#F5F5F5] rounded-l-md"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="min-w-[24px] text-center text-[12px] font-semibold tabular-nums">{qty}</span>
                          <button
                            type="button"
                            onClick={() => setQty(qty + 1)}
                            disabled={qty >= 99}
                            aria-label="Increase quantity"
                            className="h-7 w-7 flex items-center justify-center text-muted-foreground disabled:opacity-40 active:bg-[#F5F5F5] rounded-r-md"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <span className="text-[13px] font-semibold tabular-nums">{formatPrice(it.price * qty, currency)}</span>
                        {canRemove && (
                          <button
                            type="button"
                            onClick={() => removeFromCart(it.productId, it.variantId)}
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
                  {shippingActive && (
                    <div className="flex justify-between text-[12px] text-muted-foreground pt-1 border-t border-[#ECECEC]">
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
                  {couponDiscount > 0 && (
                    <div className="flex justify-between text-[12px] font-semibold text-emerald-700 pt-1 border-t border-[#ECECEC]">
                      <span>Coupon{appliedCoupon?.code ? ` (${appliedCoupon.code})` : ""}</span>
                      <span>−{formatPrice(couponDiscount, currency)}</span>
                    </div>
                  )}
                  {!isPartialOrder && prepaidDiscount > 0 && (
                    <div className="flex justify-between text-[12px] font-semibold text-emerald-700 pt-1 border-t border-[#ECECEC]">
                      <span>Prepaid discount</span>
                      <span>−{formatPrice(prepaidDiscount, currency)}</span>
                    </div>
                  )}
                  {isPartialOrder ? (
                    <>
                      <div className="flex justify-between text-[13px] pt-2 border-t border-[#ECECEC]">
                        <span className="text-muted-foreground">Order total</span>
                        <span className="tabular-nums">{formatPrice(total, currency)}</span>
                      </div>
                      <div className="flex justify-between text-[14px] font-bold text-emerald-700">
                        <span>Advance now</span>
                        <span className="tabular-nums">{formatPrice(partialAdvanceTotal, currency)}</span>
                      </div>
                      <div className="flex justify-between text-[13px]">
                        <span className="text-muted-foreground">Cash on delivery</span>
                        <span className="tabular-nums">{formatPrice(partialBalanceDue, currency)}</span>
                      </div>
                      <div className="flex justify-between text-[14px] font-bold pt-2 border-t border-[#ECECEC]">
                        <span>Total payable now</span>
                        <span className="tabular-nums">{formatPrice(chargeAmount, currency)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between text-[14px] font-bold pt-2 border-t border-[#ECECEC]">
                      <span>Total payable</span>
                      <span className="tabular-nums">{formatPrice(chargeAmount, currency)}</span>
                    </div>
                  )}

                </div>
                <div className="px-4 py-3 border-t border-[#ECECEC] flex-shrink-0">
                  <Button className="w-full h-11 bg-black hover:bg-black/90" onClick={() => setSummaryOpen(false)}>Done</Button>
                </div>
              </div>
            </div>,
            document.body
          )}


          {/* PAYMENT-FIRST CTA — when the address is missing, show a tappable
              card in-place so the shopper can see payment options underneath.
              Tapping any payment tile also opens the sheet via
              requireAddressOrPrompt() and resumes their exact tap on save. */}
          {!addressFilled && (
            <button
              type="button"
              onClick={openAddressFormSheet}
              className="w-full bg-white rounded-lg border border-dashed border-amber-400 px-3 py-2.5 flex items-center gap-2.5 active:scale-[0.99] transition-transform text-left"
            >
              <div className="h-8 w-8 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0">
                <MapPin className="h-4.5 w-4.5 text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-bold">Add delivery address</div>
                <div className="text-[10.5px] text-muted-foreground">Needed to place your order</div>
              </div>
              <Plus className="h-5 w-5 text-amber-600 flex-shrink-0" />
            </button>
          )}

          {/* Delivery Details (once address filled) — compact single-card, no heading */}
          {addressFilled && (
            <div className="bg-white rounded-xl border border-[#ECECEC] p-3">
              <div className="flex items-start gap-2.5">
                <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
                <div className="flex-1 min-w-0">
                  {/* Line 1: Deliver to <first name> — one line, right-truncate */}
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="text-[14px] font-bold truncate min-w-0 flex-1">
                      Deliver to {(fullName || "").trim().split(/\s+/)[0] || fullName}
                    </div>
                    <button
                      onClick={openAddressFormSheet}
                      className="text-[12px] font-semibold border border-[#111] rounded-md px-2.5 py-1 flex-shrink-0"
                    >Change</button>
                  </div>
                  {/* Show the complete saved address; never visually shorten it. */}
                  <div className="text-[12.5px] text-foreground/80 mt-1 whitespace-normal break-words leading-snug">
                    {streetAddress}, {city}, {state} {pincode}
                  </div>
                  {deliveryEta && (
                    <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2 py-1.5">
                      <Truck className="h-3.5 w-3.5 text-emerald-700 flex-shrink-0" />
                      <span className="text-[12.5px] font-semibold text-emerald-800 truncate">
                        Arriving {deliveryEta.shortLabel}
                      </span>
                    </div>
                  )}
                  {/* Line 3: phone with inline change link */}
                  <div className="text-[12px] text-muted-foreground mt-1 flex items-center gap-2 min-w-0">
                    <span className="truncate">+91 {phone}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setPhone("");
                        try { localStorage.removeItem("checkout_phone"); } catch { /* noop */ }
                      }}
                      className="text-[12px] font-semibold text-primary underline underline-offset-2 flex-shrink-0"
                    >
                      Change
                    </button>
                  </div>
                </div>
              </div>
              {shippingActive && (
                <div className="mt-2.5 pt-2.5 border-t border-[#ECECEC] flex items-center gap-2">
                  <div className="text-[12.5px] font-semibold">
                    {shippingCharge > 0 ? `Shipping ${formatPrice(shippingCharge, currency)}` : "Free Shipping"}
                  </div>
                  {shippingCharge === 0 && <span className="px-1.5 py-0.5 rounded-md bg-emerald-600 text-white text-[11px] font-semibold">Free</span>}
                </div>
              )}
            </div>
          )}

          {/* Offers & Rewards */}
          {/* Offers & Rewards — always visible */}
          {(
            true) && (
            <>
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-1">Offers & Rewards</div>
              <div className="bg-white rounded-lg border border-[#ECECEC] overflow-hidden">
                <div className="px-3 py-2.5">
                  {appliedCoupon ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="h-6 w-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                          <Check className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[12px] font-bold flex items-center gap-1.5 truncate">
                            "{appliedCoupon.code}" applied
                            {appliedCoupon.auto_apply && <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-emerald-100 text-emerald-700 tracking-wide">AUTO</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="rounded-b-md bg-emerald-600 px-2 py-1 text-[9px] font-extrabold leading-none text-white shadow-sm">
                          {formatPrice(couponDiscount, currency)} saved
                        </span>
                      <button onClick={() => { removeCoupon(); setCouponOpen(false); }} className="text-[10px] font-semibold text-muted-foreground">
                        Remove
                      </button>
                      </div>
                    </div>
                  ) : !couponOpen ? (
                    <button
                      type="button"
                      onClick={() => setCouponOpen(true)}
                      className="w-full flex items-center justify-between text-left"
                      aria-expanded={false}
                    >
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                          <Tag className="h-3.5 w-3.5" />
                        </div>
                        <div>
                          <div className="text-[12px] font-semibold">Have a coupon?</div>
                          <div className="text-[10px] text-muted-foreground">Tap to enter your code</div>
                        </div>
                      </div>
                      <span className="text-[11px] font-semibold text-emerald-700">Apply ›</span>
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="text-[13px] font-semibold">Enter coupon code</div>
                        <button
                          type="button"
                          onClick={() => { setCouponOpen(false); setCouponCode(""); }}
                          className="text-[12px] font-medium text-muted-foreground"
                        >
                          Cancel
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <Input
                          autoFocus
                          value={couponCode}
                          onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                          placeholder="ENTER CODE"
                          className="h-9 rounded-lg border-[#ECECEC] uppercase tracking-wider text-[12px]"
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyCoupon(); } }}
                        />
                        <Button size="sm" onClick={() => applyCoupon()} disabled={couponLoading || !couponCode.trim()} className="h-9 px-3 bg-black hover:bg-black/90 text-[12px]">
                          {couponLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Contact + Address form — bottom-sheet popup with scrim + close chip.
              Only 2 checkout screens: (1) phone, (2) full checkout. When the
              address is missing, this sheet is mandatory (no close chip, no
              dismiss) so the shopper cannot land on an empty checkout. Once
              the address is filled, tapping "Change" reopens it in editable
              mode with a close chip. */}
          {showAddressFormSheet && typeof document !== "undefined" && createPortal(
            <div className="fixed inset-0 z-[100] flex flex-col justify-end pointer-events-auto" role="dialog" aria-modal="true" aria-label="Add delivery address">
              {/* Scrim — always dismissible in payment-first flow so the shopper
                  can see the checkout underneath. If they try to pay without
                  an address, requireAddressOrPrompt() re-opens the sheet. */}
              <div
                className="absolute inset-0 bg-black/50"
                onClick={closeAddressFormSheet}
                aria-hidden
              />
              {/* Sheet — height driven by visualViewport so the keyboard never
                  hides the lower fields / Continue button (see effect above) */}
              <div ref={addressSheetRef} className="relative mx-auto w-full max-w-md bg-white rounded-t-2xl flex flex-col overflow-hidden h-[95dvh]">

              <div className="px-5 py-3 flex items-center justify-between border-b border-[#ECECEC] flex-shrink-0">
                <div className="text-[16px] font-bold">Add Delivery Address</div>
                <button
                  type="button"
                  onClick={closeAddressFormSheet}
                  aria-label="Close"
                  className="h-9 w-9 -mr-2 rounded-full flex items-center justify-center hover:bg-black/5 active:bg-black/10"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>


              <div
                ref={addressScrollRef}
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-3 pb-4 space-y-2.5"
                style={{ paddingBottom: kbInset ? kbInset + 16 : undefined, scrollPaddingBottom: kbInset ? kbInset + 16 : undefined }}
                onFocusCapture={(e) => {
                  const t = e.target as HTMLElement;
                  if (t?.tagName === "INPUT" || t?.tagName === "TEXTAREA") {
                    inputFocusedRef.current = true;
                    const vv = (window as any).visualViewport as VisualViewport | undefined;
                    const shrink = vv ? Math.max(0, Math.round(window.innerHeight - vv.height)) : 0;
                    // WebViews (Instagram/FB) never shrink the viewport — pad
                    // the scroller so the last fields can clear the keyboard.
                    if (shrink <= 80) setKbInset(Math.round(window.innerHeight * 0.42));
                    // Two passes: right after the keyboard animation starts and
                    // once it has settled. Only scrolls when actually needed.
                    setTimeout(() => ensureFieldVisible(t), 180);
                    setTimeout(() => ensureFieldVisible(t), 480);
                  }
                }}
                onBlurCapture={() => {
                  inputFocusedRef.current = false;
                  window.setTimeout(() => {
                    if (!inputFocusedRef.current) setKbInset(0);
                  }, 250);
                }}
              >


                {/* Phone entered in Step 1 — shown here with a Change link that
                    takes the shopper back to the mobile-number screen. */}
                {phone && (
                  <div className="rounded-lg border border-[#ECECEC] bg-[#FAFAFA] px-3 py-2 flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] text-muted-foreground">Mobile number</div>
                      <div className="text-[14px] font-semibold truncate">+91 {phone}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        closeAddressFormSheet();
                        setPhone("");
                        try { localStorage.removeItem("checkout_phone"); } catch { /* noop */ }
                      }}
                      className="text-[13px] font-semibold text-primary underline underline-offset-2 flex-shrink-0"
                    >
                      Change
                    </button>
                  </div>
                )}

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



                <VoiceAddressButton className="mb-3" onFill={applyVoiceAddress} />

                <form
                  onSubmit={(e) => e.preventDefault()}
                  autoComplete="on"
                  className="space-y-2.5"
                >
                <div>
                  <Label htmlFor="ck-name" className="text-[12px] text-muted-foreground">Full Name *</Label>
                  <Input
                    id="ck-name"
                    name="name"
                    autoComplete="name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    data-field="full_name"
                    placeholder="Your name"
                    className={`h-11 rounded-lg ${addressAttempted && !fullName.trim() ? "border-red-500 focus-visible:ring-red-500" : "border-[#ECECEC]"}`}
                  />
                  {addressAttempted && !fullName.trim() && (
                    <p className="mt-1 text-[12px] text-red-600">Full name required</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="ck-postal" className="text-[12px] text-muted-foreground">Pincode *</Label>
                  <div className="relative">
                    <Input
                      id="ck-postal"
                      name="postal-code"
                      autoComplete="postal-code"
                      value={pincode}
                      onChange={(e) => setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      data-field="pincode"
                      placeholder="6-digit pincode"
                      inputMode="numeric"
                      maxLength={6}
                      className={`h-11 rounded-lg ${addressAttempted && !/^\d{6}$/.test(pincode) ? "border-red-500 focus-visible:ring-red-500" : "border-[#ECECEC]"}`}
                    />
                    {pincodeLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
                  </div>
                  {addressAttempted && !/^\d{6}$/.test(pincode) && (
                    <p className="mt-1 text-[12px] text-red-600">Enter a valid 6-digit pincode</p>
                  )}
                  {deliveryEta && (
                    <p className="mt-1.5 text-[12px] font-semibold text-emerald-700 flex items-center gap-1.5">
                      <Truck className="h-3.5 w-3.5" /> Arriving {deliveryEta.shortLabel}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="ck-city" className="text-[12px] text-muted-foreground">City *</Label>
                    <Input
                      id="ck-city"
                      name="city"
                      autoComplete="address-level2"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      data-field="city"
                      className={`h-11 rounded-lg ${addressAttempted && !city.trim() ? "border-red-500 focus-visible:ring-red-500" : "border-[#ECECEC]"}`}
                    />
                    {addressAttempted && !city.trim() && (
                      <p className="mt-1 text-[12px] text-red-600">Required</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="ck-state" className="text-[12px] text-muted-foreground">State *</Label>
                    <Input
                      id="ck-state"
                      name="state"
                      autoComplete="address-level1"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      data-field="state"
                      className={`h-11 rounded-lg ${addressAttempted && !state.trim() ? "border-red-500 focus-visible:ring-red-500" : "border-[#ECECEC]"}`}
                    />
                    {addressAttempted && !state.trim() && (
                      <p className="mt-1 text-[12px] text-red-600">Required</p>
                    )}
                  </div>
                </div>


                <div>
                  <Label htmlFor="ck-street" className="text-[12px] text-muted-foreground">Complete Address *</Label>
                  <Textarea
                    id="ck-street"
                    name="address-line1"
                    autoComplete="street-address"
                    value={streetAddress}
                    onChange={(e) => setStreetAddress(e.target.value)}
                    data-field="street"
                    placeholder="House no, area, village, landmark"
                    rows={3}
                    className={`min-h-[76px] resize-none rounded-lg ${addressAttempted && !isCompleteStreetAddress(streetAddress) ? "border-red-500 focus-visible:ring-red-500" : "border-[#ECECEC]"}`}
                  />
                  {addressAttempted && !isCompleteStreetAddress(streetAddress) && (
                    <p className="mt-1 text-[12px] text-red-600">Enter house/flat, area and landmark</p>
                  )}
                </div>
                </form>




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

              <div className="flex-shrink-0 border-t border-[#ECECEC] p-3 bg-white pb-[max(env(safe-area-inset-bottom),0.75rem)]">
                <Button
                  className="w-full h-12 text-[15px] font-bold bg-black hover:bg-black/90 disabled:bg-gray-300 disabled:text-white rounded-lg"
                  onClick={() => {
                    // Find the FIRST missing field so we can tell the shopper
                    // exactly what's wrong and scroll it into view. Previously
                    // this silently set red borders — which are invisible if
                    // the field is off-screen behind the keyboard, so shoppers
                    // just kept tapping Continue and dropped off.
                    const missing: Array<[string, string]> =
                      [
                        !fullName.trim() ? ["full_name", "Please enter your full name"] as [string, string] : null,
                        !/^\d{6}$/.test(pincode) ? ["pincode", "Enter a valid 6-digit pincode"] as [string, string] : null,
                        !city.trim() ? ["city", "Enter your city"] as [string, string] : null,
                        !state.trim() ? ["state", "Enter your state"] as [string, string] : null,
                        !isCompleteStreetAddress(streetAddress) ? ["street", "Enter your complete address (house, area and landmark)"] as [string, string] : null,
                      ].filter(Boolean) as Array<[string, string]>;
                    if (missing.length > 0) {
                      setAddressAttempted(true);
                      const [field, msg] = missing[0];
                      toast.error(msg);
                      try {
                        fireStorefrontEvent({ storeId: store.id, eventName: "checkout_field_error" as any, metadata: { error: msg, field } as any });
                      } catch { /* noop */ }
                      window.setTimeout(() => {
                        const el = addressScrollRef.current?.querySelector<HTMLInputElement>(`[data-field="${field}"]`);
                        if (!el) return;
                        try { ensureFieldVisible(el); } catch { /* noop */ }
                        try { el.focus({ preventScroll: true }); } catch { /* noop */ }
                      }, 50);
                      return;
                    }

                    setAddressAttempted(false);
                    setShowAddressFormSheet(false);
                    // Resume the exact payment action the shopper selected.
                    // Android can launch immediately; the resumed iOS handler
                    // intentionally asks for one fresh tap because custom URL
                    // schemes require a current Safari/WKWebView gesture.
                    const resume = pendingPayActionRef.current;
                    pendingPayActionRef.current = null;
                    if (resume) {
                      bypassAddressGateRef.current = true;
                      resume();
                    }
                  }}
                >
                  Continue
                </Button>
              </div>
              </div>
            </div>,
            document.body

          )}

          {/* Partial-payment selector moved into payment section below */}


          {/* Trust footer only shown when payment step isn't below */}
          {!showPayment && !addressComplete && (
            <div className="pt-6 pb-2 text-center">
              <div className="text-[11px] text-muted-foreground mb-1">Powered by</div>
              <div className="inline-flex items-center justify-center gap-1.5 text-[14px] font-bold tracking-tight">
                <img src={shopbanaoLogo} alt="ShopBanao" className="h-5 w-5 inline-block object-contain" loading="lazy" width="20" height="20" />
                ShopBanao
              </div>
              <div className="text-[12px] text-muted-foreground mt-3">🔒 Your payment is securely processed by ShopBanao</div>
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
        <div className="px-3 pb-3 space-y-2">

          {/* Partial-payment mode selector — prominent, above tiles */}
          {hasPartial && (
            <div className="bg-white rounded-lg border border-[#ECECEC] p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="text-[12px] font-bold">Choose payment method</div>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">Recommended</span>
              </div>
              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => setPayMode("partial")}
                  className={`w-full text-left rounded-lg border-2 px-2.5 py-2 transition-colors ${payMode === "partial" ? "border-black bg-black/5" : "border-[#ECECEC]"}`}
                >
                  <div className="flex items-start gap-2">
                    <div className={`mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${payMode === "partial" ? "border-black bg-black" : "border-muted-foreground"}`}>
                      {payMode === "partial" && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                        Partial COD
                      </div>
                      <div className="text-[12px] font-semibold mt-0.5">
                        Pay {formatPrice(partialAdvanceTotal, currency)} advance now
                      </div>
                      <div className="text-[10.5px] text-muted-foreground">Balance {formatPrice(partialBalanceDue, currency)} on delivery</div>

                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setPayMode("full")}
                  className={`w-full text-left rounded-lg border-2 px-2.5 py-2 transition-colors ${payMode === "full" ? "border-black bg-black/5" : "border-[#ECECEC]"}`}
                >
                  <div className="flex items-start gap-2">
                    <div className={`mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${payMode === "full" ? "border-black bg-black" : "border-muted-foreground"}`}>
                      {payMode === "full" && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                          Prepaid
                        </div>
                        {prepaidDiscountPreview > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-bold text-white shadow-sm shrink-0 whitespace-nowrap">
                            <Sparkles className="h-3 w-3" /> Extra {formatPrice(prepaidDiscountPreview, currency)} OFF
                          </span>
                        )}
                      </div>
                      <div className="text-[12px] font-semibold mt-0.5">
                        Pay full {formatPrice(prepaidTotalPreview, currency)} online
                      </div>



                    </div>
                  </div>
                </button>

              </div>
              {isPartialOrder && (
                <button
                  type="button"
                  onClick={() => setBreakupOpen(true)}
                  className="mt-1.5 mx-auto flex w-fit items-center justify-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[9.5px] font-semibold text-emerald-800 active:bg-emerald-100"
                >
                  <Info className="h-3 w-3" />
                  Know more · Why pay advance?
                </button>
              )}
              {!addressFilled ? (
                <button
                  type="button"
                  onClick={openAddressFormSheet}
                  className="mt-2 w-full flex items-center justify-center gap-1.5 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-[12px] font-bold text-red-700 active:bg-red-100"
                >
                  <MapPin className="h-3.5 w-3.5" />
                  Add your delivery address to continue
                </button>
              ) : (creatingOrder || couponLoading || paymentAmountSyncing || intents.any.status === "loading") && (
                <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Updating amount…
                </div>
              )}

            </div>
          )}

          {/* Payment breakup bottom sheet — trust + explanation */}
          {breakupOpen && typeof document !== "undefined" && createPortal(
            <div className="fixed inset-0 z-[100] flex flex-col justify-end pointer-events-auto" role="dialog" aria-modal="true" aria-label="Payment breakup">
              <div className="absolute inset-0 bg-black/50" onClick={() => setBreakupOpen(false)} aria-hidden />
              <div className="relative mx-auto w-full max-w-md bg-white rounded-t-2xl flex flex-col overflow-hidden max-h-[88dvh]">
                <div className="px-5 py-3 flex items-center justify-between border-b border-[#ECECEC] flex-shrink-0">
                  <div className="text-[16px] font-bold">Payment breakup</div>
                  <button
                    type="button"
                    onClick={() => setBreakupOpen(false)}
                    aria-label="Close"
                    className="h-9 w-9 -mr-2 rounded-full flex items-center justify-center hover:bg-black/5 active:bg-black/10"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-3 pb-4 space-y-3">
                  {/* Headline strip */}
                  <div className="rounded-xl overflow-hidden border border-emerald-200">
                    <div className="flex items-center gap-2 px-3.5 py-2.5 bg-emerald-600 text-white">
                      <ShieldCheck className="h-4 w-4 shrink-0" strokeWidth={2.6} />
                      <div className="text-[13px] font-extrabold leading-tight">
                        Pay only {formatPrice(partialAdvanceTotal, currency)} now
                        <span className="opacity-80"> · </span>
                        {formatPrice(partialBalanceDue, currency)} on delivery
                      </div>
                    </div>
                    {/* Numeric breakup */}
                    <div className="bg-white px-3.5 py-3 space-y-2">
                      <div className="flex items-center justify-between text-[12.5px]">
                        <span className="flex items-center gap-1.5 text-muted-foreground"><ShoppingCart className="h-3.5 w-3.5" /> Order total</span>
                        <span className="font-semibold tabular-nums">{formatPrice(total, currency)}</span>
                      </div>
                      <div className="flex items-center justify-between text-[12.5px]">
                        <span className="flex items-center gap-1.5 text-emerald-700"><Wallet className="h-3.5 w-3.5" /> Advance now (online)</span>
                        <span className="font-bold text-emerald-700 tabular-nums">{formatPrice(partialAdvanceTotal, currency)}</span>
                      </div>
                      <div className="flex items-center justify-between text-[12.5px] pt-2 border-t border-dashed border-emerald-100">
                        <span className="flex items-center gap-1.5 text-gray-800"><Banknote className="h-3.5 w-3.5" /> Cash on delivery</span>
                        <span className="font-bold text-gray-900 tabular-nums">{formatPrice(partialBalanceDue, currency)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Trust bullets */}
                  <div className="rounded-xl border border-[#ECECEC] bg-white p-3.5 space-y-2.5">
                    <div className="flex items-start gap-2.5">
                      <div className="h-7 w-7 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0">
                        <ShieldCheck className="h-4 w-4 text-emerald-700" strokeWidth={2.4} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[12.5px] font-semibold text-gray-900">Small advance confirms your order</div>
                        <p className="text-[11.5px] leading-snug text-muted-foreground mt-0.5">
                          Helps us reduce fake orders so genuine customers like you get faster delivery.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <div className="h-7 w-7 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0">
                        <Camera className="h-4 w-4 text-emerald-700" strokeWidth={2.4} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[12.5px] font-semibold text-gray-900">Parcel photo on WhatsApp before dispatch</div>
                        <p className="text-[11.5px] leading-snug text-muted-foreground mt-0.5">
                          We'll send you a photo of your packed parcel so you know exactly what's coming.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <div className="h-7 w-7 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0">
                        <Truck className="h-4 w-4 text-emerald-700" strokeWidth={2.4} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[12.5px] font-semibold text-gray-900">Pay {formatPrice(partialBalanceDue, currency)} in cash on delivery</div>
                        <p className="text-[11.5px] leading-snug text-muted-foreground mt-0.5">
                          Hand the remaining amount to the delivery agent when your parcel arrives.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Bottom trust strip */}
                  <div className="flex items-center justify-center gap-3 text-[11px] text-muted-foreground pt-1">
                    <span className="flex items-center gap-1"><Lock className="h-3 w-3" /> Secure payment</span>
                    <span className="w-1 h-1 rounded-full bg-muted-foreground/40" />
                    <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Verified merchant</span>
                  </div>
                </div>
                <div className="px-4 py-3 border-t border-[#ECECEC] flex-shrink-0">
                  <Button className="w-full h-11 bg-black hover:bg-black/90" onClick={() => setBreakupOpen(false)}>
                    <Check className="h-4 w-4 mr-1.5" /> Got it
                  </Button>
                </div>
              </div>
            </div>,
            document.body
          )}




          {(() => {
            const allFailed = (["gpay","phonepe","paytm","bhim","any"] as UpiApp[]).every((k) => intents[k].status === "failed");
            if (gatewayOnly) return null;
            if (!allFailed) return null;

            const firstErr = intents.any.error || intents.gpay.error || "UPI is temporarily unavailable";
            return (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                <div className="font-semibold mb-1">UPI apps unavailable</div>
                <div className="mb-2 opacity-80">{firstErr}</div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full mb-2"
                  disabled={creatingOrder}
                  onClick={() => {
                    // Manual escape hatch: clears the mint caps so a shopper who
                    // hit a transient gateway/rate-limit error can get a fresh
                    // UPI intent instead of being stuck on this panel.
                    mintCountRef.current = 0;
                    mintLoopBlockedRef.current = false;
                    lastMintAtRef.current = 0;
                    void createOrderAndIntents({ userInitiated: true });
                  }}
                >
                  {creatingOrder ? <Loader2 className="h-4 w-4 animate-spin" /> : "Try again"}
                </Button>
                {hasOnline && (
                  <Button size="sm" variant="outline" className="w-full" onClick={startGatewayPayment} disabled={openingGateway || creatingOrder || couponLoading || paymentAmountSyncing}>
                    {openingGateway ? <Loader2 className="h-4 w-4 animate-spin" /> : `Pay with ${activeGateway === "razorpay" ? "Card/Wallet" : activeGateway === "cashfree" ? "Cashfree" : "PayU"}`}
                  </Button>
                )}
              </div>
            );
          })()}




          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-1">Payment Options</div>


          {/* Hosted-gateway stores (no PayU S2S UPI — e.g. Cashfree / Razorpay
              only). Showing individual UPI app tiles here is a lie: every tap
              just opens the gateway's own page where the shopper has to pick
              UPI again. So render ONE premium "Pay with <Gateway>" card.
              PayU stores are untouched and keep the direct-intent grid. */}
          {mobile && hasOnline && gatewayOnly && (
            <div className="bg-white rounded-xl border border-[#ECECEC] p-3.5 mt-2">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <img src="/icons/upi.png" alt="UPI" className="h-8 w-auto object-contain" />
                  <div className="text-[17px] font-bold tracking-tight">UPI, Cards & More</div>
                </div>
                <div className="text-[15px] font-bold">{formatPrice(chargeAmount, currency)}</div>
              </div>

              <button
                type="button"
                onClick={() => { flashUpiTap("any", 1800); void startGatewayPayment(); }}
                disabled={openingGateway || confirmingPayment || creatingOrder || couponLoading || paymentAmountSyncing}
                className="relative w-full overflow-hidden rounded-xl px-4 py-3.5 text-white font-extrabold text-[15px] flex items-center justify-center gap-2 active:scale-[0.97] transition-transform duration-150 disabled:opacity-60"
                style={{
                  background: "linear-gradient(180deg,#1f2937 0%,#111827 100%)",
                  boxShadow: "0 8px 20px -8px rgba(17,24,39,0.65), inset 0 1px 0 rgba(255,255,255,0.18)",
                }}
              >
                <span
                  className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 text-white text-[9px] leading-none font-extrabold tracking-tight px-2 py-[3px] rounded-b-[6px] whitespace-nowrap"
                  style={{
                    background: "linear-gradient(180deg,#FF5F52 0%,#E53935 60%,#C62828 100%)",
                    boxShadow: "0 1px 3px -1px rgba(198,40,40,0.6), inset 0 1px 0 rgba(255,255,255,0.4)",
                  }}
                >
                  ₹{isPartialOrder ? 50 : 100} Cashback
                </span>
                {(openingGateway || tappedUpiApp === "any")
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Opening {gatewayLabel}…</>
                  : <><Lock className="h-4 w-4" /> Pay {formatPrice(chargeAmount, currency)} with {gatewayLabel}</>}

              </button>

              <div className="mt-2.5 flex items-center justify-center gap-2 opacity-80">
                {UPI_APPS.slice(0, 4).map((app) => (
                  <img key={app.key} src={app.icon} alt={app.label} className="h-5 w-5 object-contain" loading="lazy" />
                ))}
                <span className="text-[10.5px] text-muted-foreground font-semibold">& all UPI apps</span>
              </div>
              <div className="mt-1.5 flex items-center justify-center gap-1 text-[10.5px] text-muted-foreground">
                <Lock className="h-3 w-3" /> 100% secure payment via {gatewayLabel}
              </div>
            </div>
          )}

          {/* UPI card (PayU direct-intent stores only) */}
          {mobile && hasOnline && !gatewayOnly && (

            <div className="bg-white rounded-xl border border-[#ECECEC] p-3.5 mt-2">



              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <img src="/icons/upi.png" alt="UPI" className="h-8 w-auto object-contain" />
                  <div className="text-[17px] font-bold tracking-tight">UPI</div>
                </div>
                <div className="text-[15px] font-bold">{formatPrice(chargeAmount, currency)}</div>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {UPI_APPS.slice(0, 4).map((app, i) => {
                  const s = intents[app.key];
                  const staleAmount = typeof s.amount === "number" && Math.round(s.amount * 100) !== Math.round(chargeAmount * 100);
                  // PAYMENT-FIRST: when the address is missing, keep tiles
                  // visually enabled so the shopper can tap them — the tap
                  // opens the address sheet (via requireAddressOrPrompt) and
                  // resumes this exact UPI launch on save. Only apply the
                  // real disabled state once the address is complete.
                  const addressReady = addressComplete;
                  // A `failed` tile must stay tappable — the tap is an explicit
                  // retry (see tapUpiApp). `idle` must stay tappable too: after
                  // a cancelled/declined attempt we deliberately drop the stale
                  // single-use intents back to idle, and the tap is what mints
                  // a fresh one.
                  //
                  // CRITICAL: a `loading` / re-minting / amount-syncing tile
                  // must ALSO stay tappable. Address edits, coupon changes and
                  // the debounced ship-identity snapshot re-mint the intent
                  // every few seconds; while that runs the tile used to get
                  // `pointer-events-none`, so the shopper tapped PhonePe and
                  // literally nothing happened — no launch, no queue, not even
                  // a telemetry event. tapUpiApp already queues a tap made
                  // during a mint and auto-launches the instant it is ready,
                  // so never block the pointer. Only show a spinner.
                  const retryable = s.status === "failed";
                  const needsMint = s.status === "idle";
                  const busy = addressReady && !retryable && !needsMint &&
                    (s.status !== "ready" || creatingOrder || couponLoading || paymentAmountSyncing || staleAmount);
                  
                  const bg = ["bg-sky-50", "bg-purple-50", "bg-orange-50", "bg-rose-50"][i] || "bg-gray-50";
                  const pressed = tappedUpiApp === app.key;
                  return (
                    <a
                      key={app.key}
                      href={gatewayOnly || busy || retryable || needsMint || !addressReady ? undefined : s.url}
                      onClick={(e) => {
                        // Hosted-gateway store (e.g. Cashfree without S2S UPI):
                        // the tile opens the gateway's own UPI page instead of a
                        // direct app deep-link.
                        if (gatewayOnly) {
                          e.preventDefault();
                          flashUpiTap(app.key, 1800);
                          void startGatewayPayment();
                          return;
                        }
                        tapUpiApp(app.key, e);
                      }}
                      aria-busy={busy}

                      className={`flex flex-col items-center justify-center rounded-lg ${bg} active:scale-[0.92] transition-[transform,box-shadow,opacity] duration-150 ease-out p-2.5 min-h-[92px] relative overflow-hidden select-none touch-manipulation cursor-pointer ${pressed ? "scale-[0.96] ring-2 ring-primary shadow-[0_6px_16px_-6px_rgba(0,0,0,0.35)]" : "shadow-[0_1px_2px_rgba(0,0,0,0.04)]"} ${busy ? "opacity-70" : ""} ${retryable ? "opacity-70" : ""}`}
                    >
                      {(app.key === "gpay" || app.key === "phonepe") && (
                        <span
                          className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 text-white text-[8px] leading-none font-extrabold tracking-tight px-1.5 py-[3px] rounded-b-[5px] whitespace-nowrap"
                          style={{
                            background: "linear-gradient(180deg,#FF5F52 0%,#E53935 60%,#C62828 100%)",
                            boxShadow: "0 1px 3px -1px rgba(198,40,40,0.6), inset 0 1px 0 rgba(255,255,255,0.4)",
                            textShadow: "0 1px 1px rgba(0,0,0,0.25)",
                          }}
                        >
                          ₹{isPartialOrder ? 50 : 100} Cashback
                        </span>
                      )}

                      {pressed && (
                        <span className="pointer-events-none absolute inset-0 rounded-lg bg-primary/10 animate-[fade-in_0.15s_ease-out]" aria-hidden="true" />
                      )}
                      <img
                        src={app.icon}
                        alt={app.label}
                        className={`h-8 w-8 mt-3 mb-1 object-contain transition-transform duration-150 ${pressed ? "scale-110" : ""}`}
                      />
                      <div className="text-[11px] font-semibold relative">
                        {retryable ? "Retry" : pressed ? "Opening…" : app.label}
                      </div>
                      {pressed
                        ? <Loader2 className="h-3 w-3 animate-spin mt-1 text-primary" />
                        : addressReady && (s.status === "loading" || staleAmount) && <Loader2 className="h-3 w-3 animate-spin mt-1 text-muted-foreground" />}
                    </a>
                  );
                })}
              </div>
              {(() => {
                const anyS = intents.any;
                const staleAny = typeof anyS.amount === "number" && Math.round(anyS.amount * 100) !== Math.round(chargeAmount * 100);
                const addressReady = addressComplete;
                const anyRetryable = anyS.status === "failed";
                const anyNeedsMint = anyS.status === "idle";
                // Busy = a mint/re-mint is in flight. Stays TAPPABLE (the tap is
                // queued and auto-launches when ready) — blocking pointer events
                // here was the "I tap PhonePe and nothing opens" bug.
                const anyBusy = addressReady && !anyRetryable && !anyNeedsMint && (anyS.status !== "ready" || creatingOrder || couponLoading || paymentAmountSyncing || staleAny);
                const anyPressed = tappedUpiApp === "any";
                return (
                  <a
                    href={gatewayOnly || anyBusy || anyRetryable || anyNeedsMint || !addressReady || isIOS() ? undefined : anyS.url}

                    onClick={(e) => {
                      // iOS has no Android-style `upi://` chooser. Sending an
                      // iPhone to that generic scheme is a dead tap (or opens an
                      // arbitrary app), so use the configured hosted gateway,
                      // where PayU/Cashfree/Razorpay presents its supported UPI
                      // choices and reliably returns to this checkout.
                      // Same route for hosted-gateway stores on any device.
                      if (isIOS() || gatewayOnly) {
                        e.preventDefault();
                        if (gatewayOnly) flashUpiTap("any", 1800);
                        void startGatewayPayment();
                        return;
                      }
                      tapUpiApp("any", e);
                    }}
                    aria-busy={anyBusy}
                    className={`mt-3 w-full flex items-center justify-between border rounded-lg px-3 py-2.5 select-none touch-manipulation cursor-pointer active:scale-[0.97] transition-[transform,box-shadow,border-color] duration-150 ease-out ${anyPressed ? "scale-[0.98] border-primary ring-2 ring-primary/40 bg-primary/5" : "border-[#ECECEC]"} ${anyBusy ? "opacity-70" : ""}`}
                  >

                    <span className="text-[13px] font-semibold">All UPI Apps</span>
                    <span className="flex items-center gap-2 text-[12px] text-muted-foreground font-semibold">
                      {anyPressed ? "Opening…" : gatewayOnly ? `Pay ${formatPrice(chargeAmount, currency)} with ${gatewayLabel}` : isIOS() ? "Choose payment app" : `Pay ${formatPrice(chargeAmount, currency)}`}

                      {anyPressed
                        ? <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        : <ArrowLeft className="h-4 w-4 rotate-180 text-muted-foreground" />}
                    </span>
                  </a>
                );

              })()}
              {gatewayOnly && (
                <div className="mt-2 flex items-center justify-center gap-1 text-[10.5px] text-muted-foreground">
                  <Lock className="h-3 w-3" /> Secure UPI payment via {gatewayLabel}
                </div>
              )}

            </div>
          )}

          {/* Desktop: no UPI QR — desktop shoppers pay directly via the
              hosted gateway (PayU / Cashfree / Razorpay) below, matching the
              legacy checkout. QR was removed because desktop conversion
              suffered from scan-then-approve friction. */}

          {/* Cards / Netbanking / Wallets — single consolidated gateway tile.
              Hidden on mobile hosted-gateway stores: the "Pay with <Gateway>"
              card above already opens the exact same hosted page. */}
          {hasOnline && !(mobile && gatewayOnly) && (

            <button
              onClick={startGatewayPayment}
              disabled={openingGateway || confirmingPayment || creatingOrder || couponLoading || paymentAmountSyncing}
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


          {/* Standalone COD is only for stores without partial payment.
              With partial enabled, COD means only the remaining balance after
              the configured online advance has been paid — unless the store has
              no online gateway at all, in which case COD is the only way to
              order and must always be offered. */}
          {codAvailable && (!partialConfigured || !hasOnline) && (
            <button
              onClick={() => setCodConfirmOpen(true)}
              disabled={placingCod || confirmingPayment || creatingOrder || couponLoading || paymentAmountSyncing}
              className="relative w-full bg-white rounded-xl border border-[#ECECEC] p-3.5 flex items-center justify-between active:scale-[0.99] transition-all disabled:opacity-40"
            >
              
              <div className="flex items-center gap-3">
                <Banknote className="h-5 w-5" />
                <div className="text-left">
                  <div className="text-[14px] font-bold">Cash on Delivery</div>
                  {partialEnabled && (
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      Pay full amount on delivery
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 text-[14px] font-bold">
                {formatPrice(total, currency)}
                {placingCod ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : <ArrowLeft className="h-4 w-4 rotate-180 text-muted-foreground ml-1" />}
              </div>
            </button>
          )}

          {/* COD confirm popup — bottom sheet, standalone COD only. */}
          {codConfirmOpen && typeof document !== "undefined" && createPortal(
            <div className="fixed inset-0 z-[120] flex flex-col justify-end" role="dialog" aria-modal="true" aria-label="Confirm your order">
              <div className="absolute inset-0 bg-black/60" onClick={() => { if (!placingCod) setCodConfirmOpen(false); }} aria-hidden />
              <button
                type="button"
                aria-label="Close"
                onClick={() => { if (!placingCod) setCodConfirmOpen(false); }}
                className="relative mx-auto mb-3 h-9 w-9 rounded-full bg-neutral-800 text-white flex items-center justify-center shadow-lg"
              >
                <X className="h-5 w-5" />
              </button>
              <div className="relative mx-auto w-full max-w-md bg-white rounded-t-2xl p-4 pb-6">
                <div className="text-[17px] font-bold">Confirm Your Order</div>
                <div className="mt-4 rounded-xl border border-[#ECECEC] p-4">
                  <div className="text-[15px] font-semibold">
                    Total amount: {formatPrice(total, currency)}
                  </div>
                  <button
                    type="button"
                    onClick={() => { setCodConfirmOpen(false); void placeCod(); }}
                    disabled={placingCod}
                    className="mt-4 w-full h-12 rounded-lg bg-blue-600 text-white text-[15px] font-bold flex items-center justify-center gap-2 active:scale-[0.99] transition-transform disabled:opacity-60"
                  >
                    {placingCod && <Loader2 className="h-4 w-4 animate-spin" />}
                    Yes
                  </button>
                </div>
                <div className="mt-3 text-center text-[11px] text-muted-foreground">
                  You will pay {formatPrice(total, currency)} in cash when the order is delivered.
                </div>
              </div>
            </div>,
            document.body
          )}


          {paymentConfigError && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
              <div className="font-semibold">Payment options did not load</div>
              <div className="mt-1 opacity-80">Check your connection, then try again.</div>
              <Button
                size="sm"
                variant="outline"
                className="mt-2 w-full"
                onClick={() => { void retryPaymentConfig(); }}
              >
                Try again
              </Button>
            </div>
          )}

          {!hasOnline && !codAvailable && paymentConfigLoaded && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
              {tCritical("This store has no payment methods configured. Please contact the store.", "इस स्टोर के लिए भुगतान विधि उपलब्ध नहीं है।")}
            </div>
          )}

        </div>
      )}

      {/* Sticky bottom Continue (contact step only) */}
      {!showPayment && (
        <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-[#ECECEC] p-3">
          {paymentConfigError && (
            <div className="mb-2 text-center text-[12px] font-semibold text-destructive">
              Payment options could not load. Check your connection and retry.
            </div>
          )}
          <Button
            className="w-full h-12 text-[15px] font-bold bg-black hover:bg-black/90 disabled:bg-gray-300 disabled:text-white rounded-lg"
            onClick={() => {
              if (paymentConfigError) {
                void retryPaymentConfig();
                return;
              }
              // Missing address → open the sheet (and auto-resume after save)
              // instead of firing a bare red validation toast.
              if (!requireAddressOrPrompt(() => { void createOrderAndIntents({ userInitiated: true }); })) return;
              void createOrderAndIntents({ userInitiated: true });
            }}
            disabled={creatingOrder || couponLoading || paymentAmountSyncing || (!paymentConfigLoaded && !paymentConfigError)}
          >
            {creatingOrder || (!paymentConfigLoaded && !paymentConfigError)
              ? <><Loader2 className="h-5 w-5 animate-spin" /> Loading payment options…</>
              : paymentConfigError
                ? "Retry payment options"
                : addressFilled ? "Continue to Pay" : "Continue"}
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
                    <Input name="name" autoComplete="name" placeholder="Full name *" value={newAddr.full_name} onChange={(e) => setNewAddr({ ...newAddr, full_name: e.target.value })} className="h-11 rounded-lg border-[#ECECEC]" />
                    <Input name="tel-national" autoComplete="tel-national" type="tel" placeholder="Phone *" value={newAddr.phone} onChange={(e) => setNewAddr({ ...newAddr, phone: e.target.value })} inputMode="numeric" maxLength={10} className="h-11 rounded-lg border-[#ECECEC]" />
                  </div>
                  <Input name="address-line1" autoComplete="street-address" placeholder="Flat, House no., Street, Area *" value={newAddr.street_address} onChange={(e) => setNewAddr({ ...newAddr, street_address: e.target.value })} className="h-11 rounded-lg border-[#ECECEC]" />
                  <div className="grid grid-cols-3 gap-2">
                    <Input name="postal-code" autoComplete="postal-code" placeholder="Pincode *" value={newAddr.pincode} onChange={(e) => setNewAddr({ ...newAddr, pincode: e.target.value.replace(/\D/g, "").slice(0, 6) })} inputMode="numeric" className="h-11 rounded-lg border-[#ECECEC]" />
                    <Input name="city" autoComplete="address-level2" placeholder="City *" value={newAddr.city} onChange={(e) => setNewAddr({ ...newAddr, city: e.target.value })} className="h-11 rounded-lg border-[#ECECEC]" />
                    <Input name="state" autoComplete="address-level1" placeholder="State *" value={newAddr.state} onChange={(e) => setNewAddr({ ...newAddr, state: e.target.value })} className="h-11 rounded-lg border-[#ECECEC]" />
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

      {/* Exit-intent save sheet — once per session */}
      {exitOfferDialog}
    </div>

  );
}
