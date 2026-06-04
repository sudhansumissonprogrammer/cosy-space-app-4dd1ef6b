import { Link, useOutletContext, useNavigate } from "react-router-dom";
import { formatPrice } from "@/lib/productUtils";
import { Suspense, lazy, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useCart } from "@/contexts/CartContext";
import { ArrowLeft, Minus, Plus, ShoppingCart, Trash2, MessageCircle, Package, ShoppingBag, Truck, Check } from "lucide-react";
import type { StoreData } from "@/layouts/StorefrontLayout";
import { storefrontPath } from "@/lib/subdomain";

const BuyNowPhoneModal = lazy(() => import("@/components/storefront/BuyNowPhoneModal"));

export default function V22CartPage() {
  const store = useOutletContext<StoreData>();
  const navigate = useNavigate();
  const { items, updateQuantity, removeFromCart, clearCart, cartTotal, cartCount } = useCart();
  const currency = store.currency || "USD";
  const orderMode = (store as any).order_mode || "whatsapp";
  const isSubscriptionStore = (store as any)?.billing_mode === "subscription";
  // Subscription stores: always show WA button if number exists. Commission stores: never.
  const showWhatsApp = isSubscriptionStore && !!(store as any)?.whatsapp_number;
  const showCheckout = orderMode === "website" || orderMode === "both";
  const isTheme16 = (store as any).theme === "theme-16" || (store as any).theme === "theme-21" || (store as any).theme === "theme-22";
  const [showPhoneModal, setShowPhoneModal] = useState(false);

  const { data: shippingConfig } = useQuery({
    queryKey: ["storefront-shipping-config", store.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("store_shipping_config")
        .select("free_shipping_above, flat_rate, is_active")
        .eq("store_id", store.id)
        .maybeSingle();
      return data;
    },
    enabled: !!store.id,
    staleTime: 10 * 60 * 1000,
  });

  const freeShippingThreshold = shippingConfig?.free_shipping_above;
  const shippingProgress = freeShippingThreshold ? Math.min(100, (cartTotal / freeShippingThreshold) * 100) : null;
  const shippingRemaining = freeShippingThreshold ? Math.max(0, freeShippingThreshold - cartTotal) : null;

  const handleWhatsAppOrder = () => {
    if (!store.whatsapp_number) return;
    const phone = store.whatsapp_number.replace(/[^0-9+]/g, "");
    const itemLines = items
      .map((i, idx) => `${idx + 1}. ${i.name}${i.variantName ? ` (${i.variantName})` : ""} x${i.quantity} — ${formatPrice((i.price * i.quantity), currency)}`)
      .join("\n");
    const text = `Hello, I want to order from ${store.name}:\n\n${itemLines}\n\nTotal: ${formatPrice(cartTotal, currency)}`;
    window.open(`https://wa.me/${encodeURIComponent(phone)}?text=${encodeURIComponent(text)}`, "_blank");
  };

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 lg:py-32 text-center" style={{ color: "var(--storefront-text, inherit)" }}>
        <ShoppingCart className="mx-auto mb-5 h-20 w-20 lg:h-24 lg:w-24 opacity-20" />
        <h1 className="text-2xl lg:text-3xl font-bold">Your cart is empty</h1>
        <p className="mt-2 text-base lg:text-lg opacity-60">Add some products to get started.</p>
        <Link to={storefrontPath(store.slug)} className="mt-8 inline-flex items-center justify-center h-11 lg:h-12 px-8 rounded-md text-sm lg:text-base font-bold btn-gold" style={{ borderRadius: "var(--storefront-button-radius, 0.5rem)" }}>
          CONTINUE SHOPPING
        </Link>
      </div>
    );
  }

  return (
    <>
    <div className="mx-auto max-w-3xl w-full overflow-x-hidden px-3 sm:px-4 py-4 sm:py-8" style={{ color: "var(--storefront-text, inherit)" }}>
      <div className="mb-3 sm:mb-6">
        <Link
          to={storefrontPath(store.slug)}
          className="inline-flex items-center gap-1 text-xs sm:text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft className="h-3 w-3" />
          Continue Shopping
        </Link>
      </div>

      {/* Free Shipping Progress Bar */}
      {shippingProgress !== null && shippingRemaining !== null && (
        <div className="mb-4 rounded-xl border border-emerald-200/50 bg-emerald-50/30 p-3 sm:p-4">
          {shippingRemaining > 0 ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs sm:text-sm font-semibold text-emerald-600 flex items-center gap-1.5">
                  <Truck className="h-4 w-4" />
                  Add {formatPrice(shippingRemaining, currency)} more for FREE delivery!
                </span>
                <span className="text-[10px] sm:text-xs font-medium" style={{ color: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 50%, transparent)" }}>{Math.round(shippingProgress)}%</span>
              </div>
              <div className="h-2.5 w-full rounded-full overflow-hidden" style={{ backgroundColor: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 8%, transparent)" }}>
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{
                    width: `${shippingProgress}%`,
                    background: "linear-gradient(90deg, var(--storefront-primary, #10b981), color-mix(in srgb, var(--storefront-primary, #10b981) 70%, #34d399))",
                  }}
                />
              </div>
            </div>
          ) : (
            <span className="text-xs sm:text-sm font-bold text-emerald-600 flex items-center gap-1.5">
              <Check className="h-4 w-4" /> 🎉 You qualify for FREE delivery!
            </span>
          )}
        </div>
      )}

      <h1 className="mb-3 sm:mb-6 text-lg sm:text-2xl font-bold text-foreground">Cart ({cartCount} items)</h1>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-5">
        {/* Items */}
        <div className="space-y-2 sm:space-y-3 lg:col-span-3">
          {items.map((item) => (
            <Card key={`${item.productId}-${item.variantId || ""}`} className="overflow-hidden">
              <CardContent className="flex gap-2.5 sm:gap-3 p-3 sm:p-4">
                {item.image ? (
                  <img src={item.image} alt={item.name} className="h-16 w-16 sm:h-20 sm:w-20 rounded-lg border object-cover flex-shrink-0" />
                ) : (
                  <div className="flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-lg bg-accent flex-shrink-0">
                    <Package className="h-5 w-5 sm:h-6 sm:w-6 text-muted-foreground" />
                  </div>
                )}
                <div className="flex flex-1 flex-col min-w-0">
                  <p className="text-xs sm:text-sm font-semibold text-foreground truncate">{item.name}</p>
                  {item.variantName && <p className="text-[10px] sm:text-xs text-muted-foreground">{item.variantName}</p>}
                  <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm font-bold text-foreground">{formatPrice(item.price, currency)}</p>
                  <div className="mt-auto flex items-center gap-1.5 sm:gap-2 pt-1.5 sm:pt-2">
                    <Button variant="outline" size="icon" className="h-6 w-6 sm:h-7 sm:w-7" onClick={() => updateQuantity(item.productId, item.variantId, item.quantity - 1)}>
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-5 sm:w-6 text-center text-xs sm:text-sm font-medium">{item.quantity}</span>
                    <Button variant="outline" size="icon" className="h-6 w-6 sm:h-7 sm:w-7" onClick={() => updateQuantity(item.productId, item.variantId, item.quantity + 1)}>
                      <Plus className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="ml-auto h-6 w-6 sm:h-7 sm:w-7 text-destructive hover:text-destructive" onClick={() => removeFromCart(item.productId, item.variantId)}>
                      <Trash2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          <Button variant="ghost" size="sm" className="text-xs text-destructive hover:text-destructive" onClick={clearCart}>
            Clear Cart
          </Button>
        </div>

        {/* Summary */}
        <div className="lg:col-span-2">
          <Card className="sticky top-20">
            <CardHeader className="pb-3 sm:pb-4 px-3 sm:px-6 pt-3 sm:pt-6">
              <CardTitle className="text-sm sm:text-base">Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4 px-3 sm:px-6 pb-3 sm:pb-6">
              {items.map((item) => (
                <div key={`${item.productId}-${item.variantId || ""}`} className="flex justify-between text-xs sm:text-sm gap-2">
                  <span className="text-muted-foreground truncate flex-1 min-w-0">
                    {item.name} x{item.quantity}
                  </span>
                  <span className="font-medium whitespace-nowrap">{formatPrice((item.price * item.quantity), currency)}</span>
                </div>
              ))}
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">Total</span>
                <span className="text-base sm:text-lg font-bold text-foreground">{formatPrice(cartTotal, currency)}</span>
              </div>

              <div className="space-y-2">
                {showCheckout && isTheme16 ? (
                  <button
                    className="flex h-10 sm:h-12 w-full items-center justify-center gap-2 text-xs sm:text-sm font-bold btn-gold"
                    style={{ borderRadius: "var(--storefront-button-radius, 0.5rem)" }}
                    onClick={() => setShowPhoneModal(true)}
                  >
                    <ShoppingBag className="h-4 w-4" />
                    Proceed to Checkout
                  </button>
                ) : showCheckout ? (
                  <button
                    className="flex h-10 sm:h-12 w-full items-center justify-center gap-2 text-xs sm:text-sm font-bold btn-gold"
                    style={{ borderRadius: "var(--storefront-button-radius, 0.5rem)" }}
                    onClick={() => navigate(storefrontPath(store.slug, "checkout"))}
                  >
                    <ShoppingBag className="h-4 w-4" />
                    Proceed to Checkout
                  </button>
                ) : null}
                {showWhatsApp && (
                  <button
                    className="flex h-10 sm:h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#25D366] text-xs sm:text-sm font-bold text-white transition-all hover:bg-[#1ebe5d] active:scale-[0.98] disabled:opacity-50"
                    onClick={handleWhatsAppOrder}
                    disabled={!store.whatsapp_number}
                  >
                    <svg viewBox="0 0 32 32" fill="white" className="h-4 w-4 sm:h-5 sm:w-5"><path d="M16.004 3.2C9.056 3.2 3.406 8.848 3.404 15.8c-.001 2.222.58 4.392 1.683 6.303L3.2 28.8l6.867-1.802A12.56 12.56 0 0 0 16 28.398h.005C22.95 28.398 28.6 22.75 28.6 15.8 28.6 8.85 22.95 3.2 16.004 3.2Zm0 22.997h-.004a10.44 10.44 0 0 1-5.318-1.457l-.382-.226-3.955 1.038 1.055-3.858-.249-.395A10.42 10.42 0 0 1 5.54 15.8c.002-5.77 4.697-10.463 10.466-10.463 5.77 0 10.463 4.695 10.463 10.464 0 5.77-4.695 10.465-10.465 10.465v-.069Zm5.74-7.835c-.315-.158-1.863-.92-2.152-1.025-.289-.105-.499-.158-.71.158-.21.315-.815 1.025-.999 1.236-.184.21-.368.236-.683.079-.315-.158-1.33-.49-2.533-1.562-.937-.835-1.568-1.867-1.752-2.182-.184-.315-.02-.486.138-.643.142-.141.315-.368.473-.552.158-.184.21-.315.315-.526.106-.21.053-.394-.026-.552-.079-.158-.71-1.71-.973-2.341-.256-.615-.517-.532-.71-.542-.184-.008-.394-.01-.604-.01s-.552.079-.841.394c-.29.315-1.104 1.078-1.104 2.63 0 1.552 1.13 3.052 1.288 3.262.158.21 2.224 3.396 5.388 4.762.753.326 1.341.52 1.8.665.756.24 1.444.206 1.988.125.607-.09 1.863-.762 2.126-1.498.263-.736.263-1.367.184-1.498-.079-.132-.289-.21-.604-.369Z"/></svg>
                    Order on WhatsApp
                  </button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
    {isTheme16 && (
      <Suspense fallback={null}>
        <BuyNowPhoneModal
          open={showPhoneModal}
          onOpenChange={setShowPhoneModal}
          storeSlug={store.slug}
          storeId={store.id}
          productId={items[items.length - 1]?.productId}
          productName={
            items.length > 1
              ? `${items[items.length - 1]?.name} +${items.length - 1} more`
              : items[items.length - 1]?.name
          }
          source="quick_buy_cart"
        />
      </Suspense>
    )}
    </>
  );
}
