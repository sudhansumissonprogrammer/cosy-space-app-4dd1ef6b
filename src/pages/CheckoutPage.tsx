import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useSearchParams, useOutletContext, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Loader2, CheckCircle2, ArrowLeft, Package, MapPin, CreditCard, Banknote } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import type { StoreData } from "@/layouts/StorefrontLayout";
import { storefrontPath } from "@/lib/subdomain";
import { fbPixelTrack } from "@/hooks/useFacebookPixel";
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

  const [placing, setPlacing] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"cod" | "razorpay">("cod");

  // Form
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [streetAddress, setStreetAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");

  // Auto-fill from customer's default address
  const { data: defaultAddress } = useQuery({
    queryKey: ["checkout-default-address", customer?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("customer_addresses")
        .select("*")
        .eq("storefront_customer_id", customer!.id)
        .eq("is_default", true)
        .maybeSingle();
      return data;
    },
    enabled: !!customer?.id,
  });

  useEffect(() => {
    if (defaultAddress) {
      if (!fullName) setFullName(defaultAddress.full_name || "");
      if (!phone) setPhone(defaultAddress.phone || "");
      if (!streetAddress) setStreetAddress(defaultAddress.street_address || "");
      if (!city) setCity(defaultAddress.city || "");
      if (!state) setState(defaultAddress.state || "");
      if (!pincode) setPincode(defaultAddress.pincode || "");
    }
  }, [defaultAddress]);

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
      const { data, error } = await (supabase as any)
        .from("store_payment_config")
        .select("payment_methods, razorpay_key_id")
        .eq("store_id", store.id)
        .maybeSingle();
      if (error) throw error;
      return data as { payment_methods: string[]; razorpay_key_id: string | null } | null;
    },
  });

  const availableMethods = paymentConfig?.payment_methods || ["cod"];
  const hasCod = availableMethods.includes("cod");
  const hasRazorpay = availableMethods.includes("razorpay");

  // Set default payment method
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
        quantity: 1,
        image: product.image_url,
      }]
    : cartItems.map((i) => ({
        productId: i.productId,
        name: i.variantName ? `${i.name} (${i.variantName})` : i.name,
        price: i.price,
        quantity: i.quantity,
        image: i.image || null,
      }));

  const total = checkoutItems.reduce((sum, i) => sum + i.price * i.quantity, 0);

  // Facebook Pixel: InitiateCheckout
  useEffect(() => {
    if (checkoutItems.length === 0) return;
    fbPixelTrack("InitiateCheckout", {
      content_ids: checkoutItems.map((i) => i.productId),
      contents: checkoutItems.map((i) => ({ id: i.productId, quantity: i.quantity })),
      num_items: checkoutItems.length,
      value: total,
      currency,
    });
  }, []);

  if (isLoading && isSingleMode) {
    return <CheckoutSkeleton />;
  }

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

  if (!isSingleMode && checkoutItems.length === 0) {
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
    const { data: order, error: orderErr } = await (supabase as any)
      .from("orders")
      .insert({
        store_id: store.id,
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
        ...(customer?.id ? { storefront_customer_id: customer.id } : {}),
      })
      .select("id")
      .single();
    if (orderErr) throw orderErr;

    const orderItemsData = checkoutItems.map((item) => ({
      order_id: order.id,
      product_id: item.productId,
      product_name: item.name,
      quantity: item.quantity,
      unit_price: item.price,
      total: item.price * item.quantity,
    }));
    await (supabase as any).from("order_items").insert(orderItemsData);

    await (supabase as any).from("customer_leads").insert({
      store_id: store.id,
      name: fullName.trim(),
      phone: phone.trim(),
      product_name: checkoutItems.map((i) => i.name).join(", "),
      product_id: checkoutItems.length === 1 ? checkoutItems[0].productId : null,
      source: "website_order",
    });

    return order.id as string;
  };

  const handlePlaceOrder = async () => {
    if (!fullName.trim()) { toast.error("Please enter your full name"); return; }
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) { toast.error("Please enter a valid email"); return; }
    if (!phone.trim()) { toast.error("Please enter your phone number"); return; }
    if (!streetAddress.trim()) { toast.error("Please enter your street address"); return; }
    if (!city.trim()) { toast.error("Please enter your city"); return; }
    if (!state.trim()) { toast.error("Please enter your state"); return; }
    if (!pincode.trim()) { toast.error("Please enter your pincode"); return; }

    setPlacing(true);
    try {
      const newOrderId = await createOrder();

      if (paymentMethod === "razorpay") {
        // Razorpay flow
        const loaded = await loadRazorpayScript();
        if (!loaded) throw new Error("Failed to load payment gateway");

        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
        const res = await fetch(
          `https://${projectId}.supabase.co/functions/v1/razorpay-order`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              store_id: store.id,
              amount: total,
              currency,
              order_id: newOrderId,
            }),
          }
        );
        const rzpData = await res.json();
        if (!res.ok) throw new Error(rzpData.error || "Payment initiation failed");

        const options = {
          key: rzpData.key_id,
          amount: rzpData.amount,
          currency: rzpData.currency,
          name: store.name,
          description: `Order #${newOrderId.slice(0, 8)}`,
          order_id: rzpData.razorpay_order_id,
          handler: async (response: any) => {
            try {
              const verifyRes = await fetch(
                `https://${projectId}.supabase.co/functions/v1/razorpay-verify`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    razorpay_order_id: response.razorpay_order_id,
                    razorpay_payment_id: response.razorpay_payment_id,
                    razorpay_signature: response.razorpay_signature,
                    order_id: newOrderId,
                    store_id: store.id,
                  }),
                }
              );
              const verifyData = await verifyRes.json();
              if (!verifyRes.ok) throw new Error(verifyData.error);

              if (!isSingleMode) clearCart();
              setOrderId(newOrderId);
              setOrderPlaced(true);
              fbPixelTrack("Purchase", {
                content_ids: checkoutItems.map((i) => i.productId),
                contents: checkoutItems.map((i) => ({ id: i.productId, quantity: i.quantity })),
                value: total,
                currency,
                num_items: checkoutItems.length,
              });
            } catch (err: any) {
              toast.error("Payment verification failed. Contact the store.");
            }
          },
          prefill: {
            name: fullName,
            contact: phone,
          },
          theme: { color: "#6366f1" },
          modal: {
            ondismiss: () => {
              toast.error("Payment cancelled. Your order is pending.");
              setPlacing(false);
            },
          },
        };

        const rzp = new window.Razorpay(options);
        rzp.open();
        return; // Don't setPlacing(false) here — Razorpay modal handles it
      }

      // COD flow
      if (!isSingleMode) clearCart();
      setOrderId(newOrderId);
      setOrderPlaced(true);
      fbPixelTrack("Purchase", {
        content_ids: checkoutItems.map((i) => i.productId),
        contents: checkoutItems.map((i) => ({ id: i.productId, quantity: i.quantity })),
        value: total,
        currency,
        num_items: checkoutItems.length,
      });

      // Auto-create guest account if not logged in
      if (!customer) {
        createGuestAccount(newOrderId);
      }
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
        <p className="mt-2 text-muted-foreground">
          Your order has been placed successfully. The store will contact you shortly.
        </p>
        {orderId && (
          <p className="mt-2 text-xs text-muted-foreground">
            Order ID: <span className="font-mono">{orderId.slice(0, 8)}</span>
          </p>
        )}
        <Button asChild className="mt-6">
          <Link to={storefrontPath(store.slug)}>Continue Shopping</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6">
        <Link
          to={isSingleMode ? storefrontPath(store.slug) : storefrontPath(store.slug, "cart")}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft className="h-3 w-3" />
          {isSingleMode ? `Back to ${store.name}` : "Back to Cart"}
        </Link>
      </div>

      <h1 className="mb-6 text-2xl font-bold text-foreground">Checkout</h1>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Form - 3 cols */}
        <div className="space-y-6 lg:col-span-3">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="h-4 w-4" /> Shipping Address
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="fullName">Full Name *</Label>
                  <Input id="fullName" placeholder="John Doe" value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={100} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Phone *</Label>
                  <Input id="phone" placeholder="+91 98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email *</Label>
                <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} />
                {!customer && <p className="text-xs text-muted-foreground">An account will be created so you can track your orders</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="street">Street Address *</Label>
                <Input id="street" placeholder="123 Main Street, Apt 4B" value={streetAddress} onChange={(e) => setStreetAddress(e.target.value)} maxLength={300} />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="city">City / Town *</Label>
                  <Input id="city" placeholder="Mumbai" value={city} onChange={(e) => setCity(e.target.value)} maxLength={100} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="state">State *</Label>
                  <Input id="state" placeholder="Maharashtra" value={state} onChange={(e) => setState(e.target.value)} maxLength={100} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pincode">Pincode *</Label>
                  <Input id="pincode" placeholder="400001" value={pincode} onChange={(e) => setPincode(e.target.value)} maxLength={10} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <CreditCard className="h-4 w-4" /> Payment Method
              </CardTitle>
            </CardHeader>
            <CardContent>
              {hasCod && hasRazorpay ? (
                <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as "cod" | "razorpay")} className="space-y-3">
                  <label className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 p-4 transition-all ${paymentMethod === "cod" ? "border-primary bg-primary/5" : "border-input hover:border-primary/30"}`}>
                    <RadioGroupItem value="cod" />
                    <Banknote className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Cash on Delivery</p>
                      <p className="text-xs text-muted-foreground">Pay when your order arrives</p>
                    </div>
                  </label>
                  <label className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 p-4 transition-all ${paymentMethod === "razorpay" ? "border-primary bg-primary/5" : "border-input hover:border-primary/30"}`}>
                    <RadioGroupItem value="razorpay" />
                    <CreditCard className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Pay Online</p>
                      <p className="text-xs text-muted-foreground">Cards, UPI, Net Banking, Wallets</p>
                    </div>
                  </label>
                </RadioGroup>
              ) : hasRazorpay ? (
                <div className="flex items-center gap-3 rounded-xl border-2 border-primary bg-primary/5 p-4">
                  <CreditCard className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Pay Online</p>
                    <p className="text-xs text-muted-foreground">Cards, UPI, Net Banking, Wallets</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 rounded-xl border-2 border-primary bg-primary/5 p-4">
                  <Banknote className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Cash on Delivery (COD)</p>
                    <p className="text-xs text-muted-foreground">Pay when your order arrives</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Order Summary - 2 cols */}
        <div className="lg:col-span-2">
          <Card className="sticky top-20">
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {checkoutItems.map((item, idx) => (
                <div key={idx} className="flex gap-3">
                  {item.image ? (
                    <img src={item.image} alt={item.name} className="h-14 w-14 rounded-lg border object-cover flex-shrink-0" />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-accent flex-shrink-0">
                      <Package className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                    <p className="text-sm font-semibold text-foreground">{currency} {(item.price * item.quantity).toFixed(2)}</p>
                  </div>
                </div>
              ))}

              <Separator />

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Subtotal</span>
                <span className="text-sm font-medium">{currency} {total.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Shipping</span>
                <span className="text-sm font-medium text-primary">Free</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Payment</span>
                <Badge variant="secondary">
                  {paymentMethod === "razorpay" ? "Online" : "COD"}
                </Badge>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground">Total</span>
                <span className="text-lg font-bold text-foreground">{currency} {total.toFixed(2)}</span>
              </div>

              <Button className="w-full" size="lg" onClick={handlePlaceOrder} disabled={placing}>
                {placing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {paymentMethod === "razorpay" ? "Pay Now" : "Place Order"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function CheckoutSkeleton() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Skeleton className="mb-6 h-4 w-28" />
      <Skeleton className="mb-6 h-8 w-40" />
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          {/* Address card skeleton */}
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <Skeleton className="h-5 w-40" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Skeleton className="h-10 w-full rounded-md" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
            <Skeleton className="h-10 w-full rounded-md" />
            <div className="grid gap-4 sm:grid-cols-3">
              <Skeleton className="h-10 w-full rounded-md" />
              <Skeleton className="h-10 w-full rounded-md" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
          </div>
          {/* Payment card skeleton */}
          <div className="rounded-xl border border-border bg-card p-6 space-y-3">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        </div>
        {/* Order summary skeleton */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <Skeleton className="h-5 w-32" />
            <div className="flex gap-3">
              <Skeleton className="h-14 w-14 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-20" />
              </div>
            </div>
            <Skeleton className="h-px w-full" />
            <div className="flex justify-between">
              <Skeleton className="h-5 w-12" />
              <Skeleton className="h-6 w-24" />
            </div>
            <Skeleton className="h-12 w-full rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}
