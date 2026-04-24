import { useState, useEffect, useMemo, lazy, Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useSearchParams, useOutletContext, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { sendOrderWhatsApp } from "@/lib/whatsappAutomation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { Loader2, CheckCircle2, ArrowLeft, Package, MapPin, CreditCard, Banknote, Plus, Check, ChevronDown, Tag, X, Pencil, LocateFixed } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import type { StoreData } from "@/layouts/StorefrontLayout";
import { storefrontPath } from "@/lib/subdomain";
import { fbPixelTrack, generateEventId } from "@/hooks/useFacebookPixel";
import { fireMetaCAPI } from "@/lib/metaCapi";
import { useStorefrontAuth } from "@/contexts/StorefrontAuthContext";
const PostPurchaseUpsell = lazy(() => import("@/components/storefront/PostPurchaseUpsell"));

declare global {
  interface Window {
    Razorpay: any;
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
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

// Pre-warm an edge function so it's hot when actually invoked.
// Uses OPTIONS (CORS preflight) — never executes function logic, no side effects.
function prewarmEdgeFunction(fnName: string) {
  try {
    fetch(`${SUPABASE_FUNCTIONS_URL}/${fnName}`, {
      method: "OPTIONS",
      headers: {
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type, authorization",
      },
    }).catch(() => {});
  } catch {}
}



export default function CheckoutPage() {
  const store = useOutletContext<StoreData>();
  const [searchParams] = useSearchParams();
  const productId = searchParams.get("product");
  const variantId = searchParams.get("variant");
  const { items: cartItems, clearCart } = useCart();
  const { customer, ensureCustomer } = useStorefrontAuth();
  const qc = useQueryClient();

  const [placing, setPlacing] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [showUpsell, setShowUpsell] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [expressMode, setExpressMode] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<"cod" | "razorpay">("cod");
  const [summaryOpen, setSummaryOpen] = useState(true);
  const [partialPaymentMode, setPartialPaymentMode] = useState<"full" | "partial">("partial");
  const [orderAdvancePaid, setOrderAdvancePaid] = useState(0);
  const [orderBalanceDue, setOrderBalanceDue] = useState(0);

  // Idempotency token to prevent duplicate orders
  const [checkoutToken] = useState(() => crypto.randomUUID());
  // Payment retry state: store created order for retry
  const [pendingOrder, setPendingOrder] = useState<{ id: string; number: string | null; profit: number | null } | null>(null);
  const [paymentFailed, setPaymentFailed] = useState(false);

  // Form — pre-fill from localStorage for returning users
  // Theme-16 BuyNowPhoneModal stores checkout_phone & checkout_address
  const savedInfo = (() => {
    try { return JSON.parse(localStorage.getItem(`express_checkout_${store.id}`) || "{}"); } catch { return {}; }
  })();
  const buyNowPhone = (() => { try { return localStorage.getItem("checkout_phone") || ""; } catch { return ""; } })();
  const buyNowAddress = (() => { try { return JSON.parse(localStorage.getItem("checkout_address") || "null"); } catch { return null; } })();

  const [fullName, setFullName] = useState(savedInfo.fullName || "");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState(buyNowPhone || savedInfo.phone || "");
  const [streetAddress, setStreetAddress] = useState(buyNowAddress?.street_address || savedInfo.streetAddress || "");
  const [city, setCity] = useState(buyNowAddress?.city || savedInfo.city || "");
  const [state, setState] = useState(buyNowAddress?.state || savedInfo.state || "");
  const [pincode, setPincode] = useState(buyNowAddress?.pincode || savedInfo.pincode || "");

  // Re-check localStorage for late-arriving address data (Theme-16 geocode race condition)
  useEffect(() => {
    let filled = false;
    const checkForAddress = () => {
      if (filled) return;
      try {
        const raw = localStorage.getItem("checkout_address");
        if (!raw) return;
        const addr = JSON.parse(raw);
        if (addr) {
          filled = true;
          // Use functional updates to avoid stale closures
          if (addr.street_address) setStreetAddress((prev: string) => prev || addr.street_address);
          if (addr.city) setCity((prev: string) => prev || addr.city);
          if (addr.state) setState((prev: string) => prev || addr.state);
          if (addr.pincode) setPincode((prev: string) => prev || addr.pincode);
        }
      } catch {}
    };
    // Poll aggressively for background geocode results (same-tab writes don't trigger StorageEvent)
    const interval = setInterval(checkForAddress, 800);
    const timeout = setTimeout(() => clearInterval(interval), 20000); // stop after 20s
    checkForAddress(); // immediate check
    return () => { clearInterval(interval); clearTimeout(timeout); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [showAddressDialog, setShowAddressDialog] = useState(false);
  const [newAddr, setNewAddr] = useState({ label: "Home", full_name: "", phone: "", street_address: "", city: "", state: "", pincode: "" });
  const [pincodeLoading, setPincodeLoading] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);

  // Coupon
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponLoading, setCouponLoading] = useState(false);

  // Lazily fetch/create customer record on checkout
  useEffect(() => { ensureCustomer(); }, [ensureCustomer]);

  // Scroll to top when the order-placed / upsell screen appears so users
  // see the confirmation instead of landing on the page footer.
  useEffect(() => {
    if (orderPlaced) {
      try { window.scrollTo({ top: 0, behavior: "auto" }); } catch {}
    }
  }, [orderPlaced, showUpsell]);

  // Fetch ALL saved addresses for logged-in customer
  const { data: savedAddresses } = useQuery({
    queryKey: ["checkout-saved-addresses", customer?.id],
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

  // Auto-select default address on load
  useEffect(() => {
    if (savedAddresses?.length && !selectedAddressId) {
      const defaultAddr = savedAddresses.find((a: any) => a.is_default) || savedAddresses[0];
      if (defaultAddr) selectAddress(defaultAddr);
    }
  }, [savedAddresses]);

  const selectAddress = (addr: any) => {
    setSelectedAddressId(addr.id);
    setFullName(addr.full_name || "");
    setPhone(addr.phone || "");
    setStreetAddress(addr.street_address || "");
    setCity(addr.city || "");
    setState(addr.state || "");
    setPincode(addr.pincode || "");
  };

  const selectedAddr = savedAddresses?.find((a: any) => a.id === selectedAddressId);

  // Auto-fill email from logged-in customer
  useEffect(() => {
    if (customer?.email && !email) setEmail(customer.email);
  }, [customer]);

  const isSingleMode = !!productId;

  const { data: product, isLoading } = useQuery({
    queryKey: ["checkout-product", productId],
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
  });

  const { data: variant } = useQuery({
    queryKey: ["checkout-variant", variantId],
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
  });

  // Fetch payment config for this store
  const { data: paymentConfig } = useQuery({
    queryKey: ["store-payment-config", store.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_store_payment_config", { _store_id: store.id });
      if (error) throw error;
      return data as { payment_methods: string[]; razorpay_key_id: string | null } | null;
    },
  });

  // Fetch shipping config
  const { data: shippingConfig } = useQuery({
    queryKey: ["store-shipping-config", store.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("store_shipping_config")
        .select("*")
        .eq("store_id", store.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Fetch tax config
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
  });

  // Check if store has any active coupons
  const { data: hasActiveCoupons } = useQuery({
    queryKey: ["store-has-coupons", store.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("coupons")
        .select("id", { count: "exact", head: true })
        .eq("store_id", store.id)
        .eq("is_active", true)
        .limit(1);
      if (error) throw error;
      return (count ?? 0) > 0;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Store-level partial payment config
  const storePartialEnabled = (store as any).partial_payment_enabled ?? false;
  const storePartialType = (store as any).partial_payment_type || "percentage";
  const storePartialValue = (store as any).partial_payment_value ?? null;
  const hasAnyPartialPayment = storePartialEnabled && !!storePartialValue;

  const availableMethods = paymentConfig?.payment_methods || ["cod"];
  const hasCod = availableMethods.includes("cod");
  const hasRazorpay = availableMethods.includes("razorpay");

  useEffect(() => {
    // When partial payment is enabled, always default to razorpay (COD is hidden)
    if (hasAnyPartialPayment && hasRazorpay) {
      setPaymentMethod("razorpay");
      setPartialPaymentMode("partial");
    } else if (hasCod) {
      setPaymentMethod("cod");
    } else if (hasRazorpay) {
      setPaymentMethod("razorpay");
    }
  }, [hasCod, hasRazorpay, hasAnyPartialPayment]);

  // Preload Razorpay script eagerly so it's ready instantly when user clicks Pay
  useEffect(() => {
    if (hasRazorpay) loadRazorpayScript();
  }, [hasRazorpay]);

  const currency = store.currency || "USD";
  const isHindi = store.theme === "theme-16";
  const t = (en: string, hi: string) => isHindi ? `${en} / ${hi}` : en;

  const checkoutItems = isSingleMode && product
    ? [{
        productId: product.id,
        name: variant ? `${product.name} (${variant.name})` : product.name,
        price: variant?.price ?? (product.sale_price && product.sale_price < product.price ? product.sale_price : product.price),
        originalPrice: product.price,
        quantity: 1,
        image: product.image_url,
      }]
    : cartItems.map((i) => ({
        productId: i.productId,
        name: i.variantName ? `${i.name} (${i.variantName})` : i.name,
        price: i.price,
        originalPrice: i.price,
        quantity: i.quantity,
        image: i.image || null,
      }));

  const subtotal = checkoutItems.reduce((sum, i) => sum + i.price * i.quantity, 0);

  // Shipping calculation
  const shippingActive = shippingConfig?.is_active;
  const shippingCharge = shippingActive
    ? (shippingConfig.free_shipping_above && subtotal >= Number(shippingConfig.free_shipping_above)
        ? 0
        : Number(shippingConfig.flat_rate) || 0)
    : 0;

  // Tax calculation
  const taxActive = taxConfig?.is_active && Number(taxConfig?.tax_rate) > 0;
  const taxRate = taxActive ? Number(taxConfig.tax_rate) : 0;
  const taxInclusive = taxConfig?.is_inclusive ?? false;
  const taxName = taxConfig?.tax_name || "Tax";
  let taxAmount = 0;
  if (taxActive) {
    if (taxInclusive) {
      taxAmount = subtotal - (subtotal / (1 + taxRate / 100));
    } else {
      taxAmount = (subtotal * taxRate) / 100;
    }
  }

  const total = Math.max(0, subtotal + (taxInclusive ? 0 : taxAmount) + shippingCharge - couponDiscount);

  // Partial payment calculation (store-level)
  const partialAdvanceTotal = (() => {
    if (!hasAnyPartialPayment) return total;
    let advance = 0;
    for (const item of checkoutItems) {
      let itemAdvance: number;
      if (storePartialType === "percentage") {
        itemAdvance = Math.round(item.price * (storePartialValue / 100));
      } else {
        itemAdvance = Math.min(storePartialValue, item.price);
      }
      itemAdvance = Math.max(itemAdvance, 50); // min ₹50
      advance += itemAdvance * item.quantity;
    }
    // Add tax + shipping proportionally, subtract coupon
    const ratio = subtotal > 0 ? advance / subtotal : 1;
    advance += (taxInclusive ? 0 : taxAmount) * ratio + shippingCharge;
    advance -= couponDiscount * ratio;
    return Math.max(50, Math.round(advance));
  })();
  const partialBalanceDue = Math.max(0, total - partialAdvanceTotal);
  const isPartialOrder = hasAnyPartialPayment && partialPaymentMode === "partial" && hasRazorpay;
  const chargeAmount = isPartialOrder ? partialAdvanceTotal : total;

  // Coupon logic
  const applyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponLoading(true);
    try {
      const { data, error } = await supabase
        .from("coupons")
        .select("*")
        .eq("store_id", store.id)
        .eq("code", couponCode.trim().toUpperCase())
        .eq("is_active", true)
        .maybeSingle();

      if (error) throw error;
      if (!data) { toast.error("Invalid coupon code"); setCouponLoading(false); return; }

      const now = new Date();
      if (data.starts_at && new Date(data.starts_at) > now) { toast.error("Coupon not yet active"); setCouponLoading(false); return; }
      if (data.expires_at && new Date(data.expires_at) < now) { toast.error("Coupon has expired"); setCouponLoading(false); return; }
      if (data.max_uses && data.used_count >= data.max_uses) { toast.error("Coupon usage limit reached"); setCouponLoading(false); return; }
      if (subtotal < (data.min_order_amount || 0)) { toast.error(`Minimum order amount is ${currency} ${data.min_order_amount}`); setCouponLoading(false); return; }

      let discount = 0;
      if (data.discount_type === "percentage") {
        discount = (subtotal * data.discount_value) / 100;
      } else {
        discount = data.discount_value;
      }
      discount = Math.min(discount, subtotal);

      setAppliedCoupon(data);
      setCouponDiscount(discount);
      toast.success(`Coupon applied! You save ${currency} ${discount.toFixed(2)}`);
    } catch {
      toast.error("Failed to validate coupon");
    } finally {
      setCouponLoading(false);
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponDiscount(0);
    setCouponCode("");
  };

  // Facebook Pixel + CAPI: InitiateCheckout
  useEffect(() => {
    if (checkoutItems.length === 0) return;
    const eid = generateEventId();
    const eventData = {
      content_ids: checkoutItems.map((i) => i.productId),
      contents: checkoutItems.map((i) => ({ id: i.productId, quantity: i.quantity })),
      num_items: checkoutItems.length,
      value: subtotal,
      currency,
    };
    fbPixelTrack("InitiateCheckout", eventData, eid);
    fireMetaCAPI({
      storeId: store.id,
      eventName: "InitiateCheckout",
      eventId: eid,
      customData: {
        content_ids: eventData.content_ids,
        contents: eventData.contents,
        num_items: eventData.num_items,
        value: subtotal,
        currency,
      },
    });
  }, []);

  // Save abandoned cart on checkout entry (deduplicated via sessionStorage)
  const [abandonedCartId, setAbandonedCartId] = useState<string | null>(null);
  useEffect(() => {
    if (checkoutItems.length === 0) return;
    const sessionKey = `ac_${store.id}`;
    const existingId = sessionStorage.getItem(sessionKey);
    if (existingId) {
      setAbandonedCartId(existingId);
      return;
    }
    const saveAbandonedCart = async () => {
      try {
        const { data } = await (supabase as any).from("abandoned_carts").insert({
          store_id: store.id,
          customer_email: email || null,
          customer_phone: phone || null,
          cart_items: checkoutItems.map((i) => ({ name: i.name, price: i.price, quantity: i.quantity, productId: i.productId })),
        }).select("id").single();
        if (data?.id) {
          setAbandonedCartId(data.id);
          sessionStorage.setItem(sessionKey, data.id);
        }
      } catch {}
    };
    saveAbandonedCart();
  }, []);

  if (isLoading && isSingleMode) return <CheckoutSkeleton />;

  if (isSingleMode && !product) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <Package className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
        <h1 className="text-xl font-semibold text-foreground">{t("Product not found", "उत्पाद नहीं मिला")}</h1>
        <Button asChild variant="outline" className="mt-4">
          <Link to={storefrontPath(store.slug)}><ArrowLeft className="mr-2 h-4 w-4" />{t("Back to store", "स्टोर पर वापस जाएं")}</Link>
        </Button>
      </div>
    );
  }

  if (!isSingleMode && checkoutItems.length === 0 && !orderPlaced) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <Package className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
        <h1 className="text-xl font-semibold text-foreground">{t("Your cart is empty", "आपकी कार्ट खाली है")}</h1>
        <Button asChild variant="outline" className="mt-4">
          <Link to={storefrontPath(store.slug)}><ArrowLeft className="mr-2 h-4 w-4" />{t("Back to store", "स्टोर पर वापस जाएं")}</Link>
        </Button>
      </div>
    );
  }

  const createOrder = async () => {
    const orderNotes = appliedCoupon
      ? `Coupon: ${appliedCoupon.code} (-${currency} ${couponDiscount.toFixed(2)})`
      : undefined;

    const { data, error } = await supabase.functions.invoke("place-order", {
      body: {
        store_id: store.id,
        checkout_token: checkoutToken,
        order: {
          total,
          currency,
          status: "pending",
          customer_name: fullName.trim(),
          customer_phone: phone.trim(),
          street_address: streetAddress.trim(),
          city: city.trim(),
          state: state.trim(),
          pincode: pincode.trim(),
          payment_method: isPartialOrder ? "razorpay" : paymentMethod,
          notes: orderNotes,
          storefront_customer_id: customer?.id ?? null,
          payment_type: isPartialOrder ? "partial" : "full",
        },
        items: checkoutItems.map((item) => ({
          productId: item.productId,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
        })),
        lead: {
          name: fullName.trim(),
          phone: phone.trim(),
          product_name: checkoutItems.map((i) => i.name).join(", "),
          product_id: checkoutItems.length === 1 ? checkoutItems[0].productId : null,
          source: "website_order",
        },
        coupon_id: appliedCoupon?.id ?? null,
        abandoned_cart_id: abandonedCartId ?? null,
      },
    });

    if (error) {
      throw new Error(error.message || "Failed to place order");
    }

    const result = data as { order_id?: string; order_number?: string; profit?: number | null; error?: string } | null;
    if (!result?.order_id) {
      throw new Error(result?.error || "Failed to place order");
    }

    return { id: result.order_id, number: result.order_number || null, profit: result.profit ?? null };
  };

  const createGuestAccount = async (ordId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("create-guest-account", {
        body: {
          email: email.trim(),
          phone: phone.trim(),
          name: fullName.trim(),
          store_id: store.id,
          order_id: ordId,
        },
      });

      if (error) {
        throw new Error(error.message || "Failed to create guest account");
      }

      const result = data as {
        session?: { access_token?: string; refresh_token?: string };
      } | null;

      // Auto-login with session tokens if returned
      if (result?.session?.access_token && result?.session?.refresh_token) {
        await supabase.auth.setSession({
          access_token: result.session.access_token,
          refresh_token: result.session.refresh_token,
        });
      }
    } catch (err) {
      console.error("Guest account creation failed:", err);
    }
  };

  const notifyOrderEmail = (ordId: string) => {
    void supabase.functions
      .invoke("notify-order", {
        body: { order_id: ordId, customer_email: email.trim() },
      })
      .then(({ error }) => {
        if (error) {
          console.error("notify-order error:", error.message);
        }
      })
      .catch((err) => console.error("notify-order invoke error:", err));
  };

  const saveAddressToAccount = async () => {
    if (!customer?.id) return;
    try {
      const { data: existing } = await supabase
        .from("customer_addresses")
        .select("id")
        .eq("storefront_customer_id", customer.id)
        .eq("street_address", streetAddress.trim())
        .eq("pincode", pincode.trim())
        .maybeSingle();
      if (existing) return;
      const { count } = await supabase
        .from("customer_addresses")
        .select("id", { count: "exact", head: true })
        .eq("storefront_customer_id", customer.id);
      await supabase.from("customer_addresses").insert({
        storefront_customer_id: customer.id,
        label: "Home",
        full_name: fullName.trim(),
        phone: phone.trim(),
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

  // Pincode auto-fill for Indian pincodes
  const handlePincodeChange = async (val: string) => {
    setPincode(val);
    if (val.length === 6 && /^\d{6}$/.test(val)) {
      setPincodeLoading(true);
      try {
        const res = await fetch(`https://api.postalpincode.in/pincode/${val}`);
        const data = await res.json();
        if (data?.[0]?.Status === "Success" && data[0].PostOffice?.length > 0) {
          const po = data[0].PostOffice[0];
          if (!city) setCity(po.District || "");
          if (!state) setState(po.State || "");
        }
      } catch {} finally { setPincodeLoading(false); }
    }
  };

  // Browser geolocation + Google Geocoding for accurate address
  const handleUseMyLocation = async () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation not supported by your browser");
      return;
    }
    setGeoLoading(true);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 5000,
          maximumAge: 300000,
        });
      });

      const { data, error } = await supabase.functions.invoke("reverse-geocode", {
        body: { lat: position.coords.latitude, lng: position.coords.longitude },
      });

      if (error) throw new Error(error.message);
      if (!data?.success || !data?.address) {
        toast.error("Could not determine your address");
        return;
      }

      const addr = data.address;
      if (addr.street_address) setStreetAddress(addr.street_address);
      if (addr.city) setCity(addr.city);
      if (addr.state) setState(addr.state);
      if (addr.pincode) setPincode(addr.pincode);
      toast.success("Address auto-filled!");
    } catch (err: any) {
      if (err?.code === 1) toast.error("Location permission denied");
      else toast.error("Failed to detect location");
    } finally {
      setGeoLoading(false);
    }
  };

  // Save checkout info to localStorage for express checkout
  const saveExpressInfo = () => {
    try {
      localStorage.setItem(`express_checkout_${store.id}`, JSON.stringify({
        fullName: fullName.trim(), phone: phone.trim(),
        streetAddress: streetAddress.trim(), city: city.trim(),
        state: state.trim(), pincode: pincode.trim(),
      }));
    } catch {}
  };

  const finalizeOrder = (newOrderId: string, newOrderNumber: string | null, profit?: number | null) => {
    setOrderId(newOrderId);
    setOrderNumber(newOrderNumber);
    if (isPartialOrder) {
      setOrderAdvancePaid(chargeAmount);
      setOrderBalanceDue(total - chargeAmount);
    }
    setShowUpsell(true);
    setOrderPlaced(true);
    if (!isSingleMode) clearCart();
    saveExpressInfo();
    // Clean up theme-16 BuyNow modal localStorage after order
    try { localStorage.removeItem("checkout_phone"); localStorage.removeItem("checkout_address"); } catch {}
    window.dispatchEvent(new CustomEvent("order-placed"));
    const purchaseEid = generateEventId();
    fbPixelTrack("Purchase", { content_ids: checkoutItems.map((i) => i.productId), content_type: "product", value: total, currency, num_items: checkoutItems.length }, purchaseEid);
    // Split fullName into first/last for enhanced CAPI matching
    const nameParts = fullName.trim().split(/\s+/);
    const firstName = nameParts[0] || undefined;
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : undefined;
    fireMetaCAPI({
      storeId: store.id,
      eventName: "Purchase",
      eventId: purchaseEid,
      userEmail: email.trim() || undefined,
      userPhone: phone.trim() || undefined,
      externalId: customer?.id || undefined,
      firstName,
      lastName,
      city: city.trim() || undefined,
      state: state.trim() || undefined,
      zipCode: pincode.trim() || undefined,
      customData: {
        content_ids: checkoutItems.map((i) => i.productId),
        content_type: "product",
        contents: checkoutItems.map((i) => ({ id: i.productId, quantity: i.quantity, item_price: i.price })),
        value: profit !== null && profit !== undefined ? profit : total,
        currency,
        num_items: checkoutItems.length,
        order_id: newOrderId,
      },
    });
    // Fire all post-order tasks in parallel (non-blocking)
    // Auto-login (createGuestAccount) is awaited inside finalizeOrder via the effect below
    if (!customer) { void createGuestAccount(newOrderId); } else saveAddressToAccount();
    notifyOrderEmail(newOrderId);
    sendOrderWhatsApp(store.id, newOrderId, "order_confirmation", {
      customer_phone: phone.trim(), customer_name: fullName.trim(),
      total, currency,
      product_names: checkoutItems.map((i) => i.name).join(", "),
      store_name: store.name,
    });
  };

  // Open Razorpay modal for an existing order (used for both initial and retry)
  const openRazorpayForOrder = async (order: { id: string; number: string | null; profit: number | null }) => {
    // Parallelize: load Razorpay script + create Razorpay order simultaneously
    const [loaded, rzpData] = await Promise.all([
      loadRazorpayScript(),
      callEdgeFunction("razorpay-order", {
        store_id: store.id, amount: chargeAmount, currency, order_id: order.id,
      }),
    ]);
    if (!loaded) throw new Error("Failed to load payment gateway");

    const handlePaymentSuccess = async (response: any) => {
      try {
        try {
          await callEdgeFunction("razorpay-verify", {
            ...response, order_id: order.id, store_id: store.id,
          });
        } catch (verifyErr) {
          console.warn("Razorpay verify failed, trying status fallback:", verifyErr);
          const statusData = await callEdgeFunction("razorpay-payment-status", {
            razorpay_payment_id: response.razorpay_payment_id,
            store_id: store.id, order_id: order.id,
          });
          if (statusData.status !== "captured" && statusData.status !== "authorized") {
            throw new Error("Payment verification failed");
          }
        }
        setPlacing(false);
        setPaymentFailed(false);
        setPendingOrder(null);
        finalizeOrder(order.id, order.number, order.profit);
      } catch (err: any) {
        console.error("Payment verification error:", err);
        setPlacing(false);
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
      prefill: { name: fullName, email: email || undefined, contact: phone },
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
              setPlacing(false);
              setPaymentFailed(false);
              setPendingOrder(null);
              finalizeOrder(order.id, order.number, order.profit);
              return;
            }
          } catch {}
          // Payment not completed — show retry
          setPendingOrder(order);
          setPaymentFailed(true);
          setPlacing(false);
        },
      },
    };

    const rzp = new window.Razorpay(options);
    rzp.on("payment.failed", (resp: any) => {
      console.error("Razorpay payment failed:", resp?.error);
      setPendingOrder(order);
      setPaymentFailed(true);
      setPlacing(false);
      toast.error(resp?.error?.description || "Payment failed. You can retry below.");
    });
    rzp.open();
  };

  // Retry payment for a pending order
  const handleRetryPayment = async () => {
    if (!pendingOrder) return;
    setPlacing(true);
    setPaymentFailed(false);
    try {
      await openRazorpayForOrder(pendingOrder);
    } catch (err: any) {
      toast.error(err.message || "Failed to retry payment");
      setPlacing(false);
      setPaymentFailed(true);
    }
  };

  const handlePlaceOrder = async () => {
    if (!fullName.trim()) { toast.error(t("Please enter your full name", "कृपया अपना पूरा नाम दर्ज करें")); return; }
    if (!phone.trim() || phone.trim().length < 10) { toast.error(t("Please enter a valid phone number", "कृपया एक वैध फ़ोन नंबर दर्ज करें")); return; }
    if (!streetAddress.trim()) { toast.error(t("Please enter your street address", "कृपया अपना पता दर्ज करें")); return; }
    if (!city.trim()) { toast.error(t("Please enter your city", "कृपया अपना शहर दर्ज करें")); return; }
    if (!state.trim()) { toast.error(t("Please enter your state", "कृपया अपना राज्य दर्ज करें")); return; }
    if (!pincode.trim()) { toast.error(t("Please enter your pincode", "कृपया अपना पिनकोड दर्ज करें")); return; }

    setPlacing(true);
    setPaymentFailed(false);
    try {
      const newOrder = await createOrder();

      if (paymentMethod === "razorpay" || isPartialOrder) {
        await openRazorpayForOrder(newOrder);
        return;
      }

      // COD flow
      finalizeOrder(newOrder.id, newOrder.number, newOrder.profit);
    } catch (err: any) {
      toast.error(err.message || "Failed to place order");
    } finally {
      if (paymentMethod !== "razorpay" && !isPartialOrder) setPlacing(false);
    }
  };



  if (orderPlaced) {
    // Show post-purchase upsell first, then confirmation
    if (showUpsell && orderId) {
      return (
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
      );
    }

    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center" style={{ fontFamily: "'Montserrat Alternates', sans-serif" }}>
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full" style={{ backgroundColor: "color-mix(in srgb, var(--storefront-primary) 15%, transparent)" }}>
          <CheckCircle2 className="h-8 w-8" style={{ color: "var(--storefront-primary)" }} />
        </div>
        <h1 className="text-2xl font-bold text-foreground">{t("Order Placed!", "ऑर्डर हो गया!")}</h1>
        <p className="mt-2 text-muted-foreground">{t("Your order has been placed successfully. The store will contact you shortly.", "आपका ऑर्डर सफलतापूर्वक दे दिया गया है। स्टोर जल्द ही आपसे संपर्क करेगा।")}</p>
        {(orderNumber || orderId) && <p className="mt-2 text-xs text-muted-foreground">{t("Order ID", "ऑर्डर आईडी")}: <span className="font-mono font-semibold">{orderNumber || orderId?.slice(0, 8)}</span></p>}
        <div className="mt-4 rounded-lg p-3" style={{ borderColor: "color-mix(in srgb, var(--storefront-primary) 20%, transparent)", border: "1px solid", backgroundColor: "color-mix(in srgb, var(--storefront-primary) 5%, transparent)" }}>
          <p className="text-sm text-foreground font-medium">✅ {t("Order confirmed!", "ऑर्डर कन्फर्म!")}</p>
          <p className="text-xs text-muted-foreground mt-1">{t("We'll send updates to", "हम अपडेट भेजेंगे")} <strong>{phone}</strong>{email ? ` ${t("and", "और")} ${email}` : ""}.</p>
        </div>
        {orderAdvancePaid > 0 && orderBalanceDue > 0 && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-3">
            <p className="text-sm font-semibold text-foreground">💰 {t("Partial Payment", "आंशिक भुगतान")}</p>
            <div className="mt-1.5 space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">{t("Advance Paid Online", "अग्रिम भुगतान")}</span>
                <span className="font-semibold text-emerald-600">{currency} {orderAdvancePaid.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">{t("Balance on Delivery (COD)", "डिलीवरी पर शेष")}</span>
                <span className="font-semibold text-foreground">{currency} {orderBalanceDue.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}
        <div className="mt-6 flex flex-col gap-2 items-center">
          <Link to={storefrontPath(store.slug, "account")} className="inline-flex items-center justify-center h-10 px-6 rounded-md text-sm font-medium border border-border bg-card hover:bg-accent transition-colors" style={{ borderRadius: "var(--storefront-button-radius, 0.5rem)" }}>{t("View My Orders", "मेरे ऑर्डर देखें")}</Link>
          <Link to={storefrontPath(store.slug)} className="inline-flex items-center justify-center h-10 px-6 rounded-md text-sm font-bold btn-gold" style={{ borderRadius: "var(--storefront-button-radius, 0.5rem)" }}>{t("Continue Shopping", "शॉपिंग जारी रखें")}</Link>
        </div>
      </div>
    );
  }

  const itemCount = checkoutItems.reduce((s, i) => s + i.quantity, 0);

  return (
    <div className="mx-auto max-w-lg px-4 py-6 sm:py-8 text-[13px] [&_input]:!h-11 [&_input::placeholder]:!text-[11px] [&_input::placeholder]:!font-medium [&_input]:!font-['Montserrat_Alternates'] [&_label]:!font-['Montserrat_Alternates'] [&_span]:!font-['Montserrat_Alternates'] [&_p]:!font-['Montserrat_Alternates'] [&_button]:!font-['Montserrat_Alternates']" style={{ fontFamily: "'Montserrat Alternates', sans-serif" }}>

      {/* 1. Order Summary — Collapsible */}
      <Collapsible open={summaryOpen} onOpenChange={setSummaryOpen} defaultOpen className="mb-4 rounded-xl border border-border bg-card">
        <CollapsibleTrigger className="flex w-full items-center justify-between p-4">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">{t("Order Summary", "ऑर्डर सारांश")} ({itemCount} {itemCount === 1 ? t("item", "आइटम") : t("items", "आइटम")})</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">{currency} {subtotal.toFixed(2)}</span>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${summaryOpen ? "rotate-180" : ""}`} />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t border-border px-4 pb-4 pt-3 space-y-3">
            {checkoutItems.map((item, idx) => (
              <div key={idx} className="flex gap-3">
                {item.image ? (
                  <img src={item.image} alt={item.name} className="h-14 w-14 rounded-lg border border-border object-cover flex-shrink-0" />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-accent flex-shrink-0">
                    <Package className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{t("Qty", "मात्रा")}: {item.quantity}</p>
                </div>
                <p className="text-sm font-semibold text-foreground whitespace-nowrap">{currency} {(item.price * item.quantity).toFixed(2)}</p>
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* 2. Coupon Code — only show if store has active coupons */}
      {(hasActiveCoupons || appliedCoupon) && (
      <div className="mb-4 rounded-xl border border-border bg-card p-4">
        {appliedCoupon ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-primary">{appliedCoupon.code}</span>
              <Badge variant="secondary" className="text-xs">-{currency} {couponDiscount.toFixed(2)}</Badge>
            </div>
            <button onClick={removeCoupon} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Tag className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Enter coupon code"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                className="pl-9 uppercase"
                maxLength={30}
                onKeyDown={(e) => e.key === "Enter" && applyCoupon()}
              />
            </div>
            <Button variant="outline" onClick={applyCoupon} disabled={couponLoading || !couponCode.trim()}>
              {couponLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
            </Button>
          </div>
        )}
      </div>
      )}

      {/* 3. Delivery Details */}
      <div className="mb-4 rounded-xl border border-border bg-card p-4 space-y-4">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">{t("Delivery Details", "डिलीवरी विवरण")}</span>
        </div>

        {/* Express mode for returning users with localStorage data (not logged in with saved addresses) */}
        {expressMode && !selectedAddr && savedInfo.fullName && savedInfo.phone && savedInfo.streetAddress && savedInfo.pincode ? (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <Badge variant="secondary" className="text-[9px] px-1.5 py-0 bg-primary/10 text-primary border-primary/20">⚡ Express</Badge>
                </div>
                <p className="text-sm font-medium text-foreground">{savedInfo.fullName}</p>
                <p className="text-xs text-muted-foreground">{[savedInfo.streetAddress, savedInfo.city, savedInfo.state, savedInfo.pincode].filter(Boolean).join(", ")}</p>
                <p className="text-xs text-muted-foreground">{savedInfo.phone}</p>
              </div>
              <Button size="sm" variant="ghost" className="text-xs h-7 px-2" onClick={() => setExpressMode(false)}>
                <Pencil className="h-3 w-3 mr-1" /> Edit
              </Button>
            </div>
          </div>
        ) : savedAddresses && savedAddresses.length > 0 && selectedAddr ? (
          <div className="rounded-lg border border-border bg-accent/30 p-3">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-xs font-semibold text-foreground">{selectedAddr.label}</span>
                  {selectedAddr.is_default && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Default</Badge>}
                </div>
                <p className="text-sm text-foreground">{selectedAddr.full_name}</p>
                <p className="text-xs text-muted-foreground">{[selectedAddr.street_address, selectedAddr.city, selectedAddr.state, selectedAddr.pincode].filter(Boolean).join(", ")}</p>
                {selectedAddr.phone && <p className="text-xs text-muted-foreground">{selectedAddr.phone}</p>}
              </div>
              <Button size="sm" variant="ghost" className="text-xs h-7 px-2" onClick={() => setShowAddressDialog(true)}>
                <Pencil className="h-3 w-3 mr-1" /> Change
              </Button>
            </div>
          </div>
        ) : (
          /* Phone-first express form */
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="phone" className="text-xs">{t("Phone Number", "फ़ोन नंबर")} *</Label>
                <Input id="phone" placeholder="+91 98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} autoFocus />
              </div>
              <div className="space-y-1">
                <Label htmlFor="fullName" className="text-xs">{t("Full Name", "पूरा नाम")} *</Label>
                <Input id="fullName" placeholder={isHindi ? "अपना नाम लिखें" : "John Doe"} value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={100} />
              </div>
            </div>
            {/* Use my location button - hidden for now */}
            <div className="space-y-1">
              <Label htmlFor="pincode" className="text-xs">{t("Pincode", "पिनकोड")} * {pincodeLoading && <Loader2 className="inline h-3 w-3 animate-spin ml-1" />}</Label>
              <Input id="pincode" placeholder={isHindi ? "पिनकोड डालें" : "Enter pincode to auto-fill city & state"} value={pincode} onChange={(e) => handlePincodeChange(e.target.value)} maxLength={6} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="street" className="text-xs">{t("Street Address", "पता")} *</Label>
              <Input id="street" placeholder={isHindi ? "मकान/फ्लैट नंबर, बिल्डिंग, गली" : "House/Flat No., Building, Street"} value={streetAddress} onChange={(e) => setStreetAddress(e.target.value)} maxLength={300} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="city" className="text-xs">{t("City", "शहर")} *</Label>
                <Input id="city" placeholder={isHindi ? "शहर" : "Mumbai"} value={city} onChange={(e) => setCity(e.target.value)} maxLength={100} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="state" className="text-xs">{t("State", "राज्य")} *</Label>
                <Input id="state" placeholder={isHindi ? "राज्य" : "Maharashtra"} value={state} onChange={(e) => setState(e.target.value)} maxLength={100} />
              </div>
            </div>
            {/* Email optional — collapsible */}
            <Collapsible>
              <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                <Plus className="h-3 w-3" /> {t("Add email for order updates (optional)", "ईमेल जोड़ें (वैकल्पिक)")}
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} />
              </CollapsibleContent>
            </Collapsible>
          </>
        )}
      </div>

      {/* 4. Payment Method */}
      <div className="mb-4 rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">{t("Pay via", "भुगतान करें")}</span>
          </div>
          <div className="flex items-center gap-1.5">
            {couponDiscount > 0 && (
              <span className="text-xs text-muted-foreground line-through">{currency} {subtotal.toFixed(2)}</span>
            )}
            <span className="text-sm font-bold text-foreground">{currency} {total.toFixed(2)}</span>
          </div>
        </div>

        {/* Partial Payment Option */}
        {hasAnyPartialPayment && hasRazorpay && (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => { setPartialPaymentMode("partial"); setPaymentMethod("razorpay"); }}
              className={`flex w-full items-center gap-3 rounded-xl border-2 p-3.5 text-left transition-all ${partialPaymentMode === "partial" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}
            >
              <div className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${partialPaymentMode === "partial" ? "border-primary bg-primary" : "border-muted-foreground"}`}>
                {partialPaymentMode === "partial" && <Check className="h-3 w-3 text-primary-foreground" />}
              </div>
              <CreditCard className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground">{t("Pay Advance Only", "सिर्फ़ एडवांस दें")}</p>
                  <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">{t("Recommended", "अनुशंसित")}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("Pay", "भुगतान")} {currency} {partialAdvanceTotal.toFixed(0)} {t("now", "अभी")} + {currency} {partialBalanceDue.toFixed(0)} {t("on delivery (COD)", "डिलीवरी पर (COD)")}
                </p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => { setPartialPaymentMode("full"); setPaymentMethod("razorpay"); }}
              className={`flex w-full items-center gap-3 rounded-xl border-2 p-3.5 text-left transition-all ${partialPaymentMode === "full" && paymentMethod === "razorpay" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}
            >
              <div className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${partialPaymentMode === "full" && paymentMethod === "razorpay" ? "border-primary bg-primary" : "border-muted-foreground"}`}>
                {partialPaymentMode === "full" && paymentMethod === "razorpay" && <Check className="h-3 w-3 text-primary-foreground" />}
              </div>
              <CreditCard className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">{t("Pay Full Amount Online", "पूरा ऑनलाइन भुगतान")}</p>
                <p className="text-xs text-muted-foreground">{currency} {total.toFixed(2)} — {t("UPI, Cards, Net Banking", "UPI, कार्ड, नेट बैंकिंग")}</p>
              </div>
            </button>
            {/* COD disabled when partial payment products are in cart */}
          </div>
        )}

        {/* Standard payment options (no partial payment products) */}
        {!hasAnyPartialPayment && hasRazorpay && (
          <button
            type="button"
            onClick={() => { setPaymentMethod("razorpay"); }}
            className={`flex w-full items-center gap-3 rounded-xl border-2 p-3.5 text-left transition-all ${paymentMethod === "razorpay" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}
          >
            <div className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${paymentMethod === "razorpay" ? "border-primary bg-primary" : "border-muted-foreground"}`}>
              {paymentMethod === "razorpay" && <Check className="h-3 w-3 text-primary-foreground" />}
            </div>
            <CreditCard className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium text-foreground">{t("Pay Online", "ऑनलाइन भुगतान")}</p>
              <p className="text-xs text-muted-foreground">{t("UPI, Cards, Net Banking, Wallets", "UPI, कार्ड, नेट बैंकिंग, वॉलेट")}</p>
            </div>
          </button>
        )}

        {/* COD (only when no partial payment products) */}
        {!hasAnyPartialPayment && hasCod && (
          <button
            type="button"
            onClick={() => { setPaymentMethod("cod"); }}
            className={`flex w-full items-center gap-3 rounded-xl border-2 p-3.5 text-left transition-all ${paymentMethod === "cod" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}
          >
            <div className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${paymentMethod === "cod" ? "border-primary bg-primary" : "border-muted-foreground"}`}>
              {paymentMethod === "cod" && <Check className="h-3 w-3 text-primary-foreground" />}
            </div>
            <Banknote className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium text-foreground">{t("Cash on Delivery", "कैश ऑन डिलीवरी")}</p>
              <p className="text-xs text-muted-foreground">{t("Pay when your order arrives", "ऑर्डर आने पर भुगतान करें")}</p>
            </div>
          </button>
        )}
      </div>

      {/* 5. Price Breakdown + Place Order */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{t("Subtotal", "उप-कुल")}</span>
          <span className="text-foreground">{currency} {subtotal.toFixed(2)}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{t("Shipping", "शिपिंग")}</span>
          {shippingCharge > 0 ? (
            <span className="text-foreground">{currency} {shippingCharge.toFixed(2)}</span>
          ) : (
            <span className="text-primary font-medium">{t("Free", "मुफ़्त")}</span>
          )}
        </div>
        {taxActive && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{taxName} ({taxRate}%){taxInclusive ? " (incl.)" : ""}</span>
            <span className="text-foreground">{currency} {taxAmount.toFixed(2)}</span>
          </div>
        )}
        {couponDiscount > 0 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-primary">{t("Coupon Discount", "कूपन छूट")}</span>
            <span className="text-primary font-medium">-{currency} {couponDiscount.toFixed(2)}</span>
          </div>
        )}
        <Separator />
        <div className="flex items-center justify-between">
          <span className="font-semibold text-foreground">{t("Total", "कुल")}</span>
          <span className="text-lg font-bold text-foreground">{currency} {total.toFixed(2)}</span>
        </div>
        {/* Payment retry banner */}
        {paymentFailed && pendingOrder && (
          <div className="mb-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-center">
            <p className="text-sm font-semibold text-destructive mb-1">{t("Payment failed or cancelled", "भुगतान विफल या रद्द")}</p>
            <p className="text-xs text-muted-foreground mb-2">{t("Your order is saved. No amount was deducted. Retry to complete payment.", "आपका ऑर्डर सेव है। कोई राशि नहीं काटी गई। भुगतान पूरा करने के लिए पुनः प्रयास करें।")}</p>
            <button
              className="flex h-10 w-full items-center justify-center gap-2 text-sm font-bold btn-gold disabled:opacity-50"
              style={{ borderRadius: "var(--storefront-button-radius, 0.5rem)" }}
              onClick={handleRetryPayment}
              disabled={placing}
            >
              {placing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("Retry Payment", "भुगतान पुनः प्रयास करें")} · {currency} {chargeAmount.toFixed(2)}
            </button>
          </div>
        )}
        <button
          className="flex h-12 w-full items-center justify-center gap-2 text-sm font-bold btn-gold disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ borderRadius: "var(--storefront-button-radius, 0.5rem)" }}
          onClick={handlePlaceOrder}
          disabled={placing || paymentFailed}
        >
          {placing ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t("Placing order...", "ऑर्डर हो रहा है...")}</>
          ) : (
            isPartialOrder ? `${t("Pay Advance", "एडवांस दें")} ${currency} ${chargeAmount.toFixed(2)}` : paymentMethod === "razorpay" ? `${t("Pay", "भुगतान करें")} ${currency} ${total.toFixed(2)}` : `${t("Place Order", "ऑर्डर करें")} · ${currency} ${total.toFixed(2)}`
          )}
        </button>
      </div>

      {/* Address Picker Dialog (change or add new) */}
      <Dialog open={showAddressDialog} onOpenChange={setShowAddressDialog}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("Choose Address", "पता चुनें")}</DialogTitle>
            <DialogDescription>{t("Select a saved address or add a new one.", "सेव किया हुआ पता चुनें या नया जोड़ें।")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {savedAddresses?.map((addr: any) => (
              <button
                key={addr.id}
                type="button"
                onClick={() => { selectAddress(addr); setShowAddressDialog(false); }}
                className={`relative w-full rounded-xl border-2 p-3 text-left transition-all ${selectedAddressId === addr.id ? "border-primary bg-primary/5" : "border-input hover:border-primary/30"}`}
              >
                {selectedAddressId === addr.id && (
                  <div className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                    <Check className="h-3 w-3 text-primary-foreground" />
                  </div>
                )}
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-semibold text-foreground">{addr.label}</span>
                  {addr.is_default && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Default</Badge>}
                </div>
                <p className="text-sm text-foreground">{addr.full_name}</p>
                <p className="text-xs text-muted-foreground">{[addr.street_address, addr.city, addr.state, addr.pincode].filter(Boolean).join(", ")}</p>
              </button>
            ))}
            <Separator className="my-3" />
            <p className="text-xs font-medium text-muted-foreground mb-2">{t("Add New Address", "नया पता जोड़ें")}</p>
            <div className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Label</Label>
                  <Input value={newAddr.label} onChange={(e) => setNewAddr(p => ({ ...p, label: e.target.value }))} placeholder="Home / Work" maxLength={50} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Full Name *</Label>
                  <Input value={newAddr.full_name} onChange={(e) => setNewAddr(p => ({ ...p, full_name: e.target.value }))} placeholder="John Doe" maxLength={100} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Phone *</Label>
                <Input value={newAddr.phone} onChange={(e) => setNewAddr(p => ({ ...p, phone: e.target.value }))} placeholder="+91 98765 43210" maxLength={20} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Street Address *</Label>
                <Input value={newAddr.street_address} onChange={(e) => setNewAddr(p => ({ ...p, street_address: e.target.value }))} placeholder="123 Main Street" maxLength={300} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">City *</Label>
                  <Input value={newAddr.city} onChange={(e) => setNewAddr(p => ({ ...p, city: e.target.value }))} placeholder="Mumbai" maxLength={100} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">State *</Label>
                  <Input value={newAddr.state} onChange={(e) => setNewAddr(p => ({ ...p, state: e.target.value }))} placeholder="MH" maxLength={100} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Pincode *</Label>
                  <Input value={newAddr.pincode} onChange={(e) => setNewAddr(p => ({ ...p, pincode: e.target.value }))} placeholder="400001" maxLength={10} />
                </div>
              </div>
              <button
                className="flex h-10 w-full items-center justify-center text-sm font-bold btn-gold disabled:opacity-50"
                style={{ borderRadius: "var(--storefront-button-radius, 0.5rem)" }}
                disabled={!newAddr.full_name.trim() || !newAddr.phone.trim() || !newAddr.street_address.trim() || !newAddr.city.trim() || !newAddr.state.trim() || !newAddr.pincode.trim()}
                onClick={async () => {
                  if (!customer?.id) return;
                  try {
                    const { count } = await supabase
                      .from("customer_addresses")
                      .select("id", { count: "exact", head: true })
                      .eq("storefront_customer_id", customer.id);
                    const { data: saved, error } = await supabase
                      .from("customer_addresses")
                      .insert({
                        storefront_customer_id: customer.id,
                        label: newAddr.label.trim() || "Home",
                        full_name: newAddr.full_name.trim(),
                        phone: newAddr.phone.trim(),
                        street_address: newAddr.street_address.trim(),
                        city: newAddr.city.trim(),
                        state: newAddr.state.trim(),
                        pincode: newAddr.pincode.trim(),
                        is_default: (count ?? 0) === 0,
                      })
                      .select()
                      .single();
                    if (error) throw error;
                    qc.invalidateQueries({ queryKey: ["checkout-saved-addresses", customer.id] });
                    selectAddress(saved);
                    setShowAddressDialog(false);
                    setNewAddr({ label: "Home", full_name: "", phone: "", street_address: "", city: "", state: "", pincode: "" });
                    toast.success("Address saved!");
                  } catch { toast.error("Failed to save address"); }
                }}
              >
                {t("Save & Use This Address", "पता सेव करें और इस्तेमाल करें")}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CheckoutSkeleton() {
  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <Skeleton className="mb-5 h-9 w-9 rounded-full" />
      <Skeleton className="mb-4 h-14 w-full rounded-xl" />
      <Skeleton className="mb-4 h-12 w-full rounded-xl" />
      <Skeleton className="mb-4 h-48 w-full rounded-xl" />
      <Skeleton className="mb-4 h-32 w-full rounded-xl" />
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  );
}
