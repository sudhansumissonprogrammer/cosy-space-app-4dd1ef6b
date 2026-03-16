import { useState, useEffect } from "react";
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
import { Loader2, CheckCircle2, ArrowLeft, Package, MapPin, CreditCard, Banknote, Plus, Check, ChevronDown, ChevronRight, Tag, X, Pencil, Smartphone, Wallet } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import type { StoreData } from "@/layouts/StorefrontLayout";
import { storefrontPath } from "@/lib/subdomain";
import { fbPixelTrack } from "@/hooks/useFacebookPixel";
import { fireMetaCAPI } from "@/lib/metaCapi";
import { useStorefrontAuth } from "@/contexts/StorefrontAuthContext";

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



export default function CheckoutPage() {
  const store = useOutletContext<StoreData>();
  const [searchParams] = useSearchParams();
  const productId = searchParams.get("product");
  const variantId = searchParams.get("variant");
  const { items: cartItems, clearCart } = useCart();
  const { customer } = useStorefrontAuth();
  const qc = useQueryClient();

  const [placing, setPlacing] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"cod" | "razorpay">("cod");
  const [razorpayMethod, setRazorpayMethod] = useState<"upi" | "card" | "netbanking" | "wallet">("upi");
  const [upiApp, setUpiApp] = useState<"google_pay" | "phonepe" | "paytm" | "other" | null>(null);
  const [morePaymentOpen, setMorePaymentOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);

  // Form — pre-fill from localStorage for returning users
  const savedInfo = (() => {
    try { return JSON.parse(localStorage.getItem(`express_checkout_${store.id}`) || "{}"); } catch { return {}; }
  })();
  const [fullName, setFullName] = useState(savedInfo.fullName || "");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState(savedInfo.phone || "");
  const [streetAddress, setStreetAddress] = useState(savedInfo.streetAddress || "");
  const [city, setCity] = useState(savedInfo.city || "");
  const [state, setState] = useState(savedInfo.state || "");
  const [pincode, setPincode] = useState(savedInfo.pincode || "");
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [showAddressDialog, setShowAddressDialog] = useState(false);
  const [newAddr, setNewAddr] = useState({ label: "Home", full_name: "", phone: "", street_address: "", city: "", state: "", pincode: "" });
  const [pincodeLoading, setPincodeLoading] = useState(false);

  // Coupon
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponLoading, setCouponLoading] = useState(false);

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

  const availableMethods = paymentConfig?.payment_methods || ["cod"];
  const hasCod = availableMethods.includes("cod");
  const hasRazorpay = availableMethods.includes("razorpay");

  useEffect(() => {
    if (hasCod) setPaymentMethod("cod");
    else if (hasRazorpay) setPaymentMethod("razorpay");
  }, [hasCod, hasRazorpay]);

  const currency = store.currency || "USD";

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

  // Facebook Pixel: InitiateCheckout
  useEffect(() => {
    if (checkoutItems.length === 0) return;
    fbPixelTrack("InitiateCheckout", {
      content_ids: checkoutItems.map((i) => i.productId),
      contents: checkoutItems.map((i) => ({ id: i.productId, quantity: i.quantity })),
      num_items: checkoutItems.length,
      value: subtotal,
      currency,
    });
  }, []);

  // Save abandoned cart on checkout entry
  const [abandonedCartId, setAbandonedCartId] = useState<string | null>(null);
  useEffect(() => {
    if (checkoutItems.length === 0) return;
    const saveAbandonedCart = async () => {
      try {
        const { data } = await (supabase as any).from("abandoned_carts").insert({
          store_id: store.id,
          customer_email: email || null,
          customer_phone: phone || null,
          cart_items: checkoutItems.map((i) => ({ name: i.name, price: i.price, quantity: i.quantity, productId: i.productId })),
        }).select("id").single();
        if (data?.id) setAbandonedCartId(data.id);
      } catch {}
    };
    saveAbandonedCart();
  }, []);

  if (isLoading && isSingleMode) return <CheckoutSkeleton />;

  if (isSingleMode && !product) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <Package className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
        <h1 className="text-xl font-semibold text-foreground">Product not found</h1>
        <Button asChild variant="outline" className="mt-4">
          <Link to={storefrontPath(store.slug)}><ArrowLeft className="mr-2 h-4 w-4" />Back to store</Link>
        </Button>
      </div>
    );
  }

  if (!isSingleMode && checkoutItems.length === 0 && !orderPlaced) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <Package className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
        <h1 className="text-xl font-semibold text-foreground">Your cart is empty</h1>
        <Button asChild variant="outline" className="mt-4">
          <Link to={storefrontPath(store.slug)}><ArrowLeft className="mr-2 h-4 w-4" />Back to store</Link>
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
          payment_method: paymentMethod,
          notes: orderNotes,
          storefront_customer_id: customer?.id ?? null,
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

    const result = data as { order_id?: string; order_number?: string; error?: string } | null;
    if (!result?.order_id) {
      throw new Error(result?.error || "Failed to place order");
    }

    return { id: result.order_id, number: result.order_number || null };
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

  const finalizeOrder = (newOrderId: string, newOrderNumber: string | null) => {
    setOrderId(newOrderId);
    setOrderNumber(newOrderNumber);
    setOrderPlaced(true);
    if (!isSingleMode) clearCart();
    saveExpressInfo();
    window.dispatchEvent(new CustomEvent("order-placed"));
    fbPixelTrack("Purchase", { content_ids: checkoutItems.map((i) => i.productId), value: total, currency, num_items: checkoutItems.length });
    // Fire all post-order tasks in parallel (non-blocking)
    if (!customer) createGuestAccount(newOrderId); else saveAddressToAccount();
    notifyOrderEmail(newOrderId);
    sendOrderWhatsApp(store.id, newOrderId, "order_confirmation", {
      customer_phone: phone.trim(), customer_name: fullName.trim(),
      total, currency,
      product_names: checkoutItems.map((i) => i.name).join(", "),
      store_name: store.name,
    });
  };

  const handlePlaceOrder = async () => {
    if (!fullName.trim()) { toast.error("Please enter your full name"); return; }
    if (!phone.trim() || phone.trim().length < 10) { toast.error("Please enter a valid phone number"); return; }
    if (!streetAddress.trim()) { toast.error("Please enter your street address"); return; }
    if (!city.trim()) { toast.error("Please enter your city"); return; }
    if (!state.trim()) { toast.error("Please enter your state"); return; }
    if (!pincode.trim()) { toast.error("Please enter your pincode"); return; }

    setPlacing(true);
    try {
      const newOrder = await createOrder();

      if (paymentMethod === "razorpay") {
        const loaded = await loadRazorpayScript();
        if (!loaded) throw new Error("Failed to load payment gateway");
        const { data: rzpData, error: rzpError } = await supabase.functions.invoke("razorpay-order", {
          body: { store_id: store.id, amount: total, currency, order_id: newOrder.id },
        });

        if (rzpError || !rzpData) {
          throw new Error(rzpError?.message || "Payment initiation failed");
        }

        const handlePaymentSuccess = async (response: any) => {
          try {
              const { error: verifyError } = await supabase.functions.invoke("razorpay-verify", {
                body: { ...response, order_id: newOrder.id, store_id: store.id },
              });
              if (verifyError) throw new Error("Verification failed");
              setPlacing(false);
              finalizeOrder(newOrder.id, newOrder.number);
          } catch { setPlacing(false); toast.error("Payment verification failed."); }
        };

        const options: any = {
          key: rzpData.key_id, amount: rzpData.amount, currency: rzpData.currency,
          name: store.name, description: `Order ${newOrder.number || '#' + newOrder.id.slice(0, 8)}`,
          order_id: rzpData.razorpay_order_id,
          handler: handlePaymentSuccess,
          prefill: { name: fullName, email, contact: phone },
          theme: { color: "#6366f1" },
          modal: { ondismiss: () => { toast.error("Payment cancelled."); setPlacing(false); } },
        };

        // When UPI is selected, show ONLY UPI payment option (no other tabs)
        if (razorpayMethod === "upi") {
          options.prefill.method = "upi";
          options.config = {
            display: {
              blocks: {
                utib: { name: "Pay using UPI", instruments: [{ method: "upi" }] }
              },
              sequence: ["block.utib"],
              preferences: { show_default_blocks: false },
            },
          };
        } else {
          options.config = {
            display: {
              blocks: {
                highlighted: { instruments: [{ method: razorpayMethod }] }
              },
              sequence: ["block.highlighted", "block.other"],
              preferences: { show_default_blocks: true },
            },
          };
        }

        const rzp = new window.Razorpay(options);
        rzp.open();
        return;
      }

      // COD flow
      finalizeOrder(newOrder.id, newOrder.number);
    } catch (err: any) {
      toast.error(err.message || "Failed to place order");
    } finally {
      if (paymentMethod !== "razorpay") setPlacing(false);
    }
  };



  if (orderPlaced) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <CheckCircle2 className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Order Placed!</h1>
        <p className="mt-2 text-muted-foreground">Your order has been placed successfully. The store will contact you shortly.</p>
        {(orderNumber || orderId) && <p className="mt-2 text-xs text-muted-foreground">Order ID: <span className="font-mono font-semibold">{orderNumber || orderId?.slice(0, 8)}</span></p>}
        <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-3">
          <p className="text-sm text-foreground font-medium">✅ Order confirmed!</p>
          <p className="text-xs text-muted-foreground mt-1">We'll send updates to <strong>{phone}</strong>{email ? ` and ${email}` : ""}.</p>
        </div>
        <div className="mt-6 flex flex-col gap-2 items-center">
          <Button asChild variant="outline"><Link to={storefrontPath(store.slug, "account")}>View My Orders</Link></Button>
          <Button asChild><Link to={storefrontPath(store.slug)}>Continue Shopping</Link></Button>
        </div>
      </div>
    );
  }

  const itemCount = checkoutItems.reduce((s, i) => s + i.quantity, 0);

  return (
    <div className="mx-auto max-w-lg px-4 py-6 sm:py-8 text-[13px] [&_input::placeholder]:!text-[11px] [&_input::placeholder]:!font-medium" style={{ fontFamily: "'Montserrat', sans-serif" }}>

      {/* 1. Order Summary — Collapsible */}
      <Collapsible open={summaryOpen} onOpenChange={setSummaryOpen} className="mb-4 rounded-xl border border-border bg-card">
        <CollapsibleTrigger className="flex w-full items-center justify-between p-4">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Order Summary ({itemCount} {itemCount === 1 ? "item" : "items"})</span>
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
                  <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                </div>
                <p className="text-sm font-semibold text-foreground whitespace-nowrap">{currency} {(item.price * item.quantity).toFixed(2)}</p>
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* 2. Coupon Code */}
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

      {/* 3. Delivery Details */}
      <div className="mb-4 rounded-xl border border-border bg-card p-4 space-y-4">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Delivery Details</span>
        </div>

        {/* Saved address summary or inline form */}
        {savedAddresses && savedAddresses.length > 0 && selectedAddr ? (
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
                <Label htmlFor="phone" className="text-xs">Phone Number *</Label>
                <Input id="phone" placeholder="+91 98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} autoFocus />
              </div>
              <div className="space-y-1">
                <Label htmlFor="fullName" className="text-xs">Full Name *</Label>
                <Input id="fullName" placeholder="John Doe" value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={100} />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="pincode" className="text-xs">Pincode * {pincodeLoading && <Loader2 className="inline h-3 w-3 animate-spin ml-1" />}</Label>
              <Input id="pincode" placeholder="Enter pincode to auto-fill city & state" value={pincode} onChange={(e) => handlePincodeChange(e.target.value)} maxLength={6} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="street" className="text-xs">Street Address *</Label>
              <Input id="street" placeholder="House/Flat No., Building, Street" value={streetAddress} onChange={(e) => setStreetAddress(e.target.value)} maxLength={300} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="city" className="text-xs">City *</Label>
                <Input id="city" placeholder="Mumbai" value={city} onChange={(e) => setCity(e.target.value)} maxLength={100} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="state" className="text-xs">State *</Label>
                <Input id="state" placeholder="Maharashtra" value={state} onChange={(e) => setState(e.target.value)} maxLength={100} />
              </div>
            </div>
            {/* Email optional — collapsible */}
            <Collapsible>
              <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                <Plus className="h-3 w-3" /> Add email for order updates (optional)
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
            <span className="text-sm font-medium text-foreground">Pay via</span>
          </div>
          <div className="flex items-center gap-1.5">
            {couponDiscount > 0 && (
              <span className="text-xs text-muted-foreground line-through">{currency} {subtotal.toFixed(2)}</span>
            )}
            <span className="text-sm font-bold text-foreground">{currency} {total.toFixed(2)}</span>
          </div>
        </div>

        {hasRazorpay && (
          <>
            {/* UPI App Grid */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">UPI</p>
              <div className="grid grid-cols-4 gap-2 sm:gap-3">
                {/* Google Pay */}
                <button
                  type="button"
                  onClick={() => { setPaymentMethod("razorpay"); setRazorpayMethod("upi"); setUpiApp("google_pay"); }}
                  className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl border-2 p-3 sm:p-4 transition-all ${paymentMethod === "razorpay" && upiApp === "google_pay" ? "border-primary bg-primary/5 shadow-md" : "border-border hover:border-primary/30 hover:shadow-sm"}`}
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted/60">
                    <img src="/icons/gpay.svg" alt="Google Pay" className="h-7 w-7 object-contain" />
                  </div>
                  <span className="text-[11px] font-semibold text-foreground">GPay</span>
                </button>

                {/* PhonePe */}
                <button
                  type="button"
                  onClick={() => { setPaymentMethod("razorpay"); setRazorpayMethod("upi"); setUpiApp("phonepe"); }}
                  className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl border-2 p-3 sm:p-4 transition-all ${paymentMethod === "razorpay" && upiApp === "phonepe" ? "border-primary bg-primary/5 shadow-md" : "border-border hover:border-primary/30 hover:shadow-sm"}`}
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted/60">
                    <img src="/icons/phonepe.svg" alt="PhonePe" className="h-7 w-7 object-contain" />
                  </div>
                  <span className="text-[11px] font-semibold text-foreground">PhonePe</span>
                </button>

                {/* Paytm */}
                <button
                  type="button"
                  onClick={() => { setPaymentMethod("razorpay"); setRazorpayMethod("upi"); setUpiApp("paytm"); }}
                  className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl border-2 p-3 sm:p-4 transition-all ${paymentMethod === "razorpay" && upiApp === "paytm" ? "border-primary bg-primary/5 shadow-md" : "border-border hover:border-primary/30 hover:shadow-sm"}`}
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted/60">
                    <img src="/icons/paytm.svg" alt="Paytm" className="h-7 w-7 object-contain" />
                  </div>
                  <span className="text-[11px] font-semibold text-foreground">Paytm</span>
                </button>

                {/* Others */}
                <button
                  type="button"
                  onClick={() => { setPaymentMethod("razorpay"); setRazorpayMethod("upi"); setUpiApp("other"); }}
                  className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl border-2 p-3 sm:p-4 transition-all ${paymentMethod === "razorpay" && upiApp === "other" ? "border-primary bg-primary/5 shadow-md" : "border-border hover:border-primary/30 hover:shadow-sm"}`}
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted/60">
                    <Smartphone className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <span className="text-[11px] font-semibold text-foreground">Others</span>
                </button>
              </div>
            </div>

            {/* More Payment Options — Collapsible */}
            <Collapsible open={morePaymentOpen} onOpenChange={setMorePaymentOpen}>
              <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <span className="font-medium">More payment options</span>
                <ChevronRight className={`h-4 w-4 transition-transform ${morePaymentOpen ? "rotate-90" : ""}`} />
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2 pt-1">
                {/* Cards */}
                <button
                  type="button"
                  onClick={() => { setPaymentMethod("razorpay"); setRazorpayMethod("card"); setUpiApp(null); }}
                  className={`flex w-full items-center gap-3 rounded-xl border-2 p-3 text-left transition-all ${paymentMethod === "razorpay" && razorpayMethod === "card" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}
                >
                  <div className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${paymentMethod === "razorpay" && razorpayMethod === "card" ? "border-primary bg-primary" : "border-muted-foreground"}`}>
                    {paymentMethod === "razorpay" && razorpayMethod === "card" && <Check className="h-3 w-3 text-primary-foreground" />}
                  </div>
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">Credit / Debit Card</p>
                    <p className="text-[11px] text-muted-foreground">Visa, Mastercard, RuPay</p>
                  </div>
                </button>

                {/* Net Banking */}
                <button
                  type="button"
                  onClick={() => { setPaymentMethod("razorpay"); setRazorpayMethod("netbanking"); setUpiApp(null); }}
                  className={`flex w-full items-center gap-3 rounded-xl border-2 p-3 text-left transition-all ${paymentMethod === "razorpay" && razorpayMethod === "netbanking" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}
                >
                  <div className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${paymentMethod === "razorpay" && razorpayMethod === "netbanking" ? "border-primary bg-primary" : "border-muted-foreground"}`}>
                    {paymentMethod === "razorpay" && razorpayMethod === "netbanking" && <Check className="h-3 w-3 text-primary-foreground" />}
                  </div>
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">Net Banking</p>
                    <p className="text-[11px] text-muted-foreground">All major banks</p>
                  </div>
                </button>

                {/* Wallets */}
                <button
                  type="button"
                  onClick={() => { setPaymentMethod("razorpay"); setRazorpayMethod("wallet"); setUpiApp(null); }}
                  className={`flex w-full items-center gap-3 rounded-xl border-2 p-3 text-left transition-all ${paymentMethod === "razorpay" && razorpayMethod === "wallet" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}
                >
                  <div className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${paymentMethod === "razorpay" && razorpayMethod === "wallet" ? "border-primary bg-primary" : "border-muted-foreground"}`}>
                    {paymentMethod === "razorpay" && razorpayMethod === "wallet" && <Check className="h-3 w-3 text-primary-foreground" />}
                  </div>
                  <Smartphone className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">Wallets</p>
                    <p className="text-[11px] text-muted-foreground">Paytm, Mobikwik, Freecharge</p>
                  </div>
                </button>
              </CollapsibleContent>
            </Collapsible>
          </>
        )}

        {/* COD */}
        {hasCod && (
          <button
            type="button"
            onClick={() => { setPaymentMethod("cod"); setUpiApp(null); }}
            className={`flex w-full items-center gap-3 rounded-xl border-2 p-3.5 text-left transition-all ${paymentMethod === "cod" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}
          >
            <div className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${paymentMethod === "cod" ? "border-primary bg-primary" : "border-muted-foreground"}`}>
              {paymentMethod === "cod" && <Check className="h-3 w-3 text-primary-foreground" />}
            </div>
            <Banknote className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium text-foreground">Cash on Delivery</p>
              <p className="text-xs text-muted-foreground">Pay when your order arrives</p>
            </div>
          </button>
        )}
      </div>

      {/* 5. Price Breakdown + Place Order */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="text-foreground">{currency} {subtotal.toFixed(2)}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Shipping</span>
          {shippingCharge > 0 ? (
            <span className="text-foreground">{currency} {shippingCharge.toFixed(2)}</span>
          ) : (
            <span className="text-primary font-medium">Free</span>
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
            <span className="text-primary">Coupon Discount</span>
            <span className="text-primary font-medium">-{currency} {couponDiscount.toFixed(2)}</span>
          </div>
        )}
        <Separator />
        <div className="flex items-center justify-between">
          <span className="font-semibold text-foreground">Total</span>
          <span className="text-lg font-bold text-foreground">{currency} {total.toFixed(2)}</span>
        </div>
        <Button className="w-full" size="lg" onClick={handlePlaceOrder} disabled={placing}>
          {placing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {paymentMethod === "razorpay" ? `Pay ${currency} ${total.toFixed(2)}` : `Place Order · ${currency} ${total.toFixed(2)}`}
        </Button>
      </div>

      {/* Address Picker Dialog (change or add new) */}
      <Dialog open={showAddressDialog} onOpenChange={setShowAddressDialog}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Choose Address</DialogTitle>
            <DialogDescription>Select a saved address or add a new one.</DialogDescription>
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
            <p className="text-xs font-medium text-muted-foreground mb-2">Add New Address</p>
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
              <Button
                className="w-full"
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
                Save & Use This Address
              </Button>
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
