import { Link } from "react-router-dom";
import { formatPrice } from "@/lib/productUtils";
import { Suspense, lazy, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { useCart } from "@/contexts/CartContext";
import { Minus, Plus, Trash2, ShoppingCart, ShoppingBag, MessageCircle, Package, X, Truck, Check } from "lucide-react";
import type { StoreData } from "@/layouts/StorefrontLayout";
import { storefrontPath } from "@/lib/subdomain";
import CartUpsell from "@/components/storefront/CartUpsell";

const BuyNowPhoneModal = lazy(() => import("@/components/storefront/BuyNowPhoneModal"));

interface SideCartProps {
  store: StoreData;
}

export default function SideCart({ store }: SideCartProps) {
  const { items, updateQuantity, removeFromCart, clearCart, cartTotal, cartCount, isCartOpen, closeCart } = useCart();
  const currency = store.currency || "USD";
  const orderMode = (store as any).order_mode || "whatsapp";
  const isSubscriptionStore = (store as any)?.billing_mode === "subscription";
  // Subscription stores: always show WA button if number exists. Commission stores: never.
  const showWhatsApp = isSubscriptionStore && !!(store as any)?.whatsapp_number;
  const isTheme16 = (store as any).theme === "theme-16" || (store as any).theme === "theme-21" || (store as any).theme === "theme-22";
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const showCheckout = orderMode === "website" || orderMode === "both";

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

  return (
    <>
    <Sheet open={isCartOpen} onOpenChange={(open) => !open && closeCart()}>
      <SheetContent side="right" className="rubber-sheet storefront-font flex w-[85vw] max-w-md lg:max-w-lg flex-col p-0 sm:w-[400px] lg:w-[460px]" style={{ backgroundColor: "var(--storefront-bg, #ffffff)", color: "var(--storefront-text, inherit)" }}>
        {/* Header */}
        <SheetHeader className="border-b px-4 py-4">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2 text-lg font-bold">
              <ShoppingCart className="h-5 w-5" />
              Cart ({cartCount})
            </SheetTitle>
          </div>
        </SheetHeader>

        {/* Items */}
        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4">
            <ShoppingCart className="h-20 w-20" style={{ color: "color-mix(in srgb, var(--storefront-text, inherit) 15%, transparent)" }} />
            <p className="text-lg font-semibold" style={{ color: "var(--storefront-text, inherit)" }}>Your cart is empty</p>
            <p className="text-sm" style={{ color: "color-mix(in srgb, var(--storefront-text, inherit) 60%, transparent)" }}>Browse products and add your favorites</p>
            <Button variant="outline" onClick={closeCart} className="mt-2">
              Continue Shopping
            </Button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-4 py-3">
              <div className="space-y-3">
                {items.map((item) => (
                  <div
                    key={`${item.productId}-${item.variantId || ""}`}
                    className="flex gap-3 rounded-xl p-3" style={{ border: "1px solid color-mix(in srgb, var(--storefront-text, inherit) 10%, transparent)", backgroundColor: "color-mix(in srgb, var(--storefront-text, inherit) 3%, var(--storefront-bg, #fff))" }}
                  >
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.name}
                        className="h-24 w-24 shrink-0 rounded-lg border object-cover"
                      />
                    ) : (
                      <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: "color-mix(in srgb, var(--storefront-text, inherit) 5%, var(--storefront-bg, #fff))" }}>
                        <Package className="h-6 w-6" style={{ color: "color-mix(in srgb, var(--storefront-text, inherit) 40%, transparent)" }} />
                      </div>
                    )}
                    <div className="flex flex-1 flex-col min-w-0">
                      <p className="text-sm font-semibold line-clamp-2" style={{ color: "var(--storefront-text, inherit)" }}>{item.name}</p>
                      {item.variantName && (
                        <p className="text-xs" style={{ color: "color-mix(in srgb, var(--storefront-text, inherit) 60%, transparent)" }}>{item.variantName}</p>
                      )}
                      <p className="mt-0.5 text-sm font-bold" style={{ color: "var(--storefront-text, inherit)" }}>
                        {formatPrice((item.price * item.quantity), currency)}
                      </p>
                      <div className="mt-auto flex items-center gap-2 pt-1.5">
                        <div className="flex items-center rounded-lg" style={{ border: "1px solid color-mix(in srgb, var(--storefront-text, inherit) 12%, transparent)" }}>
                          <button
                            onClick={() => updateQuantity(item.productId, item.variantId, item.quantity - 1)}
                            className="flex h-8 w-8 items-center justify-center transition-colors active:scale-90" style={{ color: "color-mix(in srgb, var(--storefront-text, inherit) 60%, transparent)" }}
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span key={item.quantity} className="w-8 text-center text-sm font-semibold qty-bounce">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.productId, item.variantId, item.quantity + 1)}
                            className="flex h-8 w-8 items-center justify-center transition-colors active:scale-90" style={{ color: "color-mix(in srgb, var(--storefront-text, inherit) 60%, transparent)" }}
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <button
                          onClick={() => removeFromCart(item.productId, item.variantId)}
                          className="ml-auto flex h-7 w-7 items-center justify-center rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {items.length > 0 && (
                <button
                  onClick={clearCart}
                  className="mt-3 text-xs font-medium text-destructive hover:underline"
                >
                  Clear Cart
                </button>
              )}

              {/* Upsell */}
              <CartUpsell storeId={store.id} currency={currency} />
            </div>

            {/* Footer / Checkout */}
            <div className="border-t px-4 py-2.5 space-y-1.5" style={{ backgroundColor: "var(--storefront-bg, inherit)" }}>
              {/* Free Shipping Progress Bar */}
              {shippingProgress !== null && shippingRemaining !== null && (
                <div className="mb-1">
                  {shippingRemaining > 0 ? (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-semibold text-emerald-600 flex items-center gap-1">
                          <Truck className="h-3 w-3" />
                          Add {formatPrice(shippingRemaining, currency)} more for FREE delivery!
                        </span>
                        <span className="text-[9px]" style={{ color: "color-mix(in srgb, var(--storefront-text, inherit) 50%, transparent)" }}>{Math.round(shippingProgress)}%</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ backgroundColor: "color-mix(in srgb, var(--storefront-text, inherit) 8%, transparent)" }}>
                        <div
                          className="h-full rounded-full transition-all duration-500 ease-out"
                          style={{
                            width: `${shippingProgress}%`,
                            background: "linear-gradient(90deg, var(--storefront-primary, #10b981), color-mix(in srgb, var(--storefront-primary, #10b981) 70%, #34d399))",
                          }}
                        />
                      </div>
                    </div>
                  ) : (
                    <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                      <Check className="h-3 w-3" /> 🎉 You qualify for FREE delivery!
                    </span>
                  )}
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium" style={{ color: "color-mix(in srgb, var(--storefront-text, inherit) 60%, transparent)" }}>Subtotal</span>
                <span className="text-sm font-bold" style={{ color: "var(--storefront-text, inherit)" }}>
                  {formatPrice(cartTotal, currency)}
                </span>
              </div>
              <div className="space-y-1.5">
                {showCheckout && isTheme16 ? (
                  <button
                    onClick={() => { closeCart(); setShowPhoneModal(true); }}
                    className="flex h-10 w-full items-center justify-center gap-2 rounded-xl text-xs font-bold transition-all hover:brightness-110 active:scale-[0.98]" style={{ backgroundColor: "var(--storefront-primary, hsl(var(--primary)))", color: "var(--storefront-btn-text, hsl(var(--primary-foreground)))" }}
                  >
                    <ShoppingBag className="h-4 w-4" />
                    Proceed to Checkout
                  </button>
                ) : showCheckout ? (
                  <Link
                    to={storefrontPath(store.slug, "checkout")}
                    onClick={closeCart}
                    className="flex h-10 w-full items-center justify-center gap-2 rounded-xl text-xs font-bold transition-all hover:brightness-110 active:scale-[0.98]" style={{ backgroundColor: "var(--storefront-primary, hsl(var(--primary)))", color: "var(--storefront-btn-text, hsl(var(--primary-foreground)))" }}
                  >
                    <ShoppingBag className="h-4 w-4" />
                    Proceed to Checkout
                  </Link>
                ) : null}
                {showWhatsApp && (
                  <button
                    className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] text-xs font-bold text-white transition-all hover:bg-[#1ebe5d] active:scale-[0.98] disabled:opacity-50"
                    onClick={handleWhatsAppOrder}
                    disabled={!store.whatsapp_number}
                  >
                    <svg viewBox="0 0 32 32" fill="white" className="h-4 w-4"><path d="M16.004 3.2C9.056 3.2 3.406 8.848 3.404 15.8c-.001 2.222.58 4.392 1.683 6.303L3.2 28.8l6.867-1.802A12.56 12.56 0 0 0 16 28.398h.005C22.95 28.398 28.6 22.75 28.6 15.8 28.6 8.85 22.95 3.2 16.004 3.2Zm0 22.997h-.004a10.44 10.44 0 0 1-5.318-1.457l-.382-.226-3.955 1.038 1.055-3.858-.249-.395A10.42 10.42 0 0 1 5.54 15.8c.002-5.77 4.697-10.463 10.466-10.463 5.77 0 10.463 4.695 10.463 10.464 0 5.77-4.695 10.465-10.465 10.465v-.069Zm5.74-7.835c-.315-.158-1.863-.92-2.152-1.025-.289-.105-.499-.158-.71.158-.21.315-.815 1.025-.999 1.236-.184.21-.368.236-.683.079-.315-.158-1.33-.49-2.533-1.562-.937-.835-1.568-1.867-1.752-2.182-.184-.315-.02-.486.138-.643.142-.141.315-.368.473-.552.158-.184.21-.315.315-.526.106-.21.053-.394-.026-.552-.079-.158-.71-1.71-.973-2.341-.256-.615-.517-.532-.71-.542-.184-.008-.394-.01-.604-.01s-.552.079-.841.394c-.29.315-1.104 1.078-1.104 2.63 0 1.552 1.13 3.052 1.288 3.262.158.21 2.224 3.396 5.388 4.762.753.326 1.341.52 1.8.665.756.24 1.444.206 1.988.125.607-.09 1.863-.762 2.126-1.498.263-.736.263-1.367.184-1.498-.079-.132-.289-.21-.604-.369Z"/></svg>
                    Order on WhatsApp
                  </button>
                )}
              </div>
              <button
                onClick={closeCart}
                className="w-full text-[11px] font-medium py-1 transition-colors" style={{ color: "color-mix(in srgb, var(--storefront-text, inherit) 60%, transparent)" }}
              >
                Continue Shopping
              </button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
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
          source="quick_buy_sidecart"
        />
      </Suspense>
    )}
    </>
  );
}
