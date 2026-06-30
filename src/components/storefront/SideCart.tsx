import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { useCart } from "@/contexts/CartContext";
import { Minus, Plus, Trash2, ShoppingCart, ShoppingBag, Package, X, Truck, Check } from "lucide-react";
import type { StoreData } from "@/layouts/StorefrontLayout";
import { storefrontPath } from "@/lib/subdomain";
import CartUpsell from "@/components/storefront/CartUpsell";

interface SideCartProps {
  store: StoreData;
}

export default function SideCart({ store }: SideCartProps) {
  const { items, updateQuantity, removeFromCart, clearCart, cartTotal, cartCount, isCartOpen, closeCart } = useCart();
  const currency = store.currency || "USD";
  // TEMP DISABLED: phone-lead modal + map autofill — go straight to /checkout.
  // To re-enable, restore: (store as any).theme === "theme-16" || "theme-21" || "theme-22"
  const isTheme16 = false;
  const showCheckout = true;

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
                            className="flex h-11 w-11 min-h-11 min-w-11 items-center justify-center transition-colors active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md" style={{ color: "color-mix(in srgb, var(--storefront-text, inherit) 60%, transparent)" }}
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span key={item.quantity} className="w-8 text-center text-sm font-semibold qty-bounce">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.productId, item.variantId, item.quantity + 1)}
                            className="flex h-11 w-11 min-h-11 min-w-11 items-center justify-center transition-colors active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md" style={{ color: "color-mix(in srgb, var(--storefront-text, inherit) 60%, transparent)" }}
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
                          className="h-full rounded-full transition-[transform,opacity,colors,box-shadow] duration-500 ease-out"
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
                    onClick={closeCart}
                    className="flex h-10 w-full items-center justify-center gap-2 rounded-xl text-xs font-bold transition-[transform,opacity,colors,box-shadow] hover:brightness-110 active:scale-[0.98]" style={{ backgroundColor: "var(--storefront-primary, hsl(var(--primary)))", color: "var(--storefront-btn-text, hsl(var(--primary-foreground)))" }}
                  >
                    <ShoppingBag className="h-4 w-4" />
                    Proceed to Checkout
                  </button>
                ) : showCheckout ? (
                  <Link
                    to={storefrontPath(store.slug, "checkout")}
                    onClick={closeCart}
                    className="flex h-10 w-full items-center justify-center gap-2 rounded-xl text-xs font-bold transition-[transform,opacity,colors,box-shadow] hover:brightness-110 active:scale-[0.98]" style={{ backgroundColor: "var(--storefront-primary, hsl(var(--primary)))", color: "var(--storefront-btn-text, hsl(var(--primary-foreground)))" }}
                  >
                    <ShoppingBag className="h-4 w-4" />
                    Proceed to Checkout
                  </Link>
                ) : null}
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
    </>
  );
}
