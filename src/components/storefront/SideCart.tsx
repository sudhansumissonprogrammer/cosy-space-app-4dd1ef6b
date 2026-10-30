import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useCart } from "@/contexts/CartContext";
import { ShoppingCart, Truck, Check } from "lucide-react";
import type { StoreData } from "@/layouts/StorefrontLayout";
import { formatPrice } from "@/lib/productUtils";
import CartUpsell from "@/components/storefront/CartUpsell";
import UpsellStrip from "@/components/storefront/apps/Upsell/UpsellStrip";
import { useUpsellOffers } from "@/hooks/useUpsellOffers";
import { matchOffers } from "@/lib/appStore/upsell/matchEngine";
import { useCartCarouselPools } from "@/hooks/useCartCarouselPools";
import CartItemsCarousel from "@/components/storefront/cart/CartItemsCarousel";
import CartProductCarousel from "@/components/storefront/cart/CartProductCarousel";
import CartStealDealsHeader from "@/components/storefront/cart/CartStealDealsHeader";
import CartTotalsFooter from "@/components/storefront/cart/CartTotalsFooter";

interface SideCartProps {
  store: StoreData;
}

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default function SideCart({ store }: SideCartProps) {
  const { items, updateQuantity, removeFromCart, clearCart, cartTotal, cartCount, isCartOpen, closeCart } = useCart();
  const currency = store.currency || "USD";

  const cartProductIds = useMemo(
    () => items.map((i) => i.productId).filter((id): id is string => !!id && !id.startsWith("bundle:")),
    [items],
  );

  /* ── Shipping progress (unchanged) ─────────────────────────────── */
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

  /* ── Merchant-configured upsell offers (unchanged) ─────────────── */
  const { data: upsellOffersAll } = useUpsellOffers(store.slug);
  const cartUpsellOffers = useMemo(() => {
    if (!upsellOffersAll?.length) return [];
    return matchOffers(upsellOffersAll, {
      placement: "cart_drawer",
      cart: { productIds: cartProductIds, totalValue: cartTotal, totalQty: cartCount },
    });
  }, [upsellOffersAll, cartProductIds, cartTotal, cartCount]);

  /* ── MRP of cart products (for "saved so far") ─────────────────── */
  const { data: cartProductRows } = useQuery({
    queryKey: ["cart-product-mrp", store.id, cartProductIds.join("|")],
    enabled: isCartOpen && !!store.id && cartProductIds.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("products")
        .select("id,price,sale_price,category")
        .in("id", cartProductIds);
      return (data || []) as { id: string; price: number; sale_price: number | null; category: string | null }[];
    },
  });

  const mrpTotal = useMemo(() => {
    const map = new Map((cartProductRows || []).map((p) => [p.id, Number(p.price) || 0]));
    return items.reduce((sum, i) => {
      const mrp = map.get(i.productId) ?? i.price;
      return sum + Math.max(mrp, i.price) * i.quantity;
    }, 0);
  }, [items, cartProductRows]);

  const cartCategories = useMemo(() => {
    const set = new Set<string>();
    (cartProductRows || []).forEach((p) => p.category && set.add(p.category));
    return Array.from(set);
  }, [cartProductRows]);

  /* ── Auto-apply coupon (drives UPI discount + steal-deal tag) ──── */
  const { data: coupon } = useQuery({
    queryKey: ["store-auto-apply-coupon", store.id],
    enabled: isCartOpen && !!store.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await (supabase as any).rpc("get_store_auto_apply_coupon", { _store_id: store.id });
      return Array.isArray(data) ? data[0] ?? null : data ?? null;
    },
  });

  const couponDiscount = useMemo(() => {
    if (!coupon || cartTotal <= 0) return 0;
    const minOrder = Number(coupon.min_order_amount || 0);
    if (cartTotal < minOrder) return 0;
    const isPct = coupon.discount_type === "percentage" || coupon.discount_type === "percent";
    const raw = isPct ? cartTotal * (Number(coupon.discount_value) / 100) : Number(coupon.discount_value);
    return Math.max(0, Math.min(Math.round(raw), cartTotal));
  }, [coupon, cartTotal]);

  const flatOffLabel = couponDiscount > 0 ? `FLAT ${formatPrice(couponDiscount, currency)} OFF` : null;

  /* ── Three deduped upsell carousels (PDP engine) ───────────────── */
  const { same, best, other, otherCategory } = useCartCarouselPools({
    storeId: store.id,
    cartProductIds,
    cartCategories,
    enabled: isCartOpen && items.length > 0,
  });

  return (
    <Sheet open={isCartOpen} onOpenChange={(open) => !open && closeCart()}>
      <SheetContent
        side="right"
        className="rubber-sheet storefront-font sfg flex w-[85vw] max-w-md lg:max-w-lg flex-col p-0 sm:w-[400px] lg:w-[460px]"
        style={{ backgroundColor: "color-mix(in srgb, var(--storefront-bg, #ffffff) 86%, transparent)", color: "var(--storefront-text, inherit)" }}
      >
        <SheetHeader className="sfg sfg-bar-top sfg-strong shrink-0 px-3 py-2" style={{ backgroundColor: "color-mix(in srgb, var(--storefront-bg, #ffffff) 62%, transparent)" }}>
          <SheetTitle className="flex items-center gap-2 text-[15px] font-bold">
            <ShoppingCart className="h-4 w-4" />
            Cart ({cartCount})
          </SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4">
            <ShoppingCart className="h-20 w-20" style={{ color: "color-mix(in srgb, var(--storefront-text, inherit) 15%, transparent)" }} />
            <p className="text-lg font-semibold">Your cart is empty</p>
            <p className="text-sm opacity-60">Browse products and add your favorites</p>
            <Button variant="outline" onClick={closeCart} className="mt-2">
              Continue Shopping
            </Button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-3 py-2">
              <CartItemsCarousel
                items={items}
                currency={currency}
                updateQuantity={updateQuantity}
                removeFromCart={removeFromCart}
              />

              <button onClick={clearCart} className="mt-1.5 text-[10px] font-medium text-destructive hover:underline">
                Clear Cart
              </button>

              {cartUpsellOffers.length > 0 && (
                <UpsellStrip
                  storeId={store.id}
                  currency={currency}
                  offers={cartUpsellOffers}
                  placement="cart_drawer"
                  excludeProductIds={cartProductIds}
                />
              )}

              <CartStealDealsHeader flatOffLabel={flatOffLabel} />

              <CartProductCarousel
                title={cartCategories.length === 1 ? `More in ${titleCase(cartCategories[0])}` : "Frequently bought together"}
                items={same.items}
                slug={store.slug}
                currency={currency}
                highlight
                hasNextPage={same.query.hasNextPage}
                isFetchingNextPage={same.query.isFetchingNextPage}
                fetchNextPage={same.query.fetchNextPage}
              />
              <CartProductCarousel
                title="Best sellers"
                items={best.items}
                slug={store.slug}
                currency={currency}
                hasNextPage={best.query.hasNextPage}
                isFetchingNextPage={best.query.isFetchingNextPage}
                fetchNextPage={best.query.fetchNextPage}
              />
              <CartProductCarousel
                title={otherCategory ? `You may also like — ${titleCase(otherCategory)}` : "You may also like"}
                items={other.items}
                slug={store.slug}
                currency={currency}
                hasNextPage={other.query.hasNextPage}
                isFetchingNextPage={other.query.isFetchingNextPage}
                fetchNextPage={other.query.fetchNextPage}
              />

              {same.items.length === 0 && best.items.length === 0 && other.items.length === 0 && (
                <CartUpsell storeId={store.id} currency={currency} />
              )}
            </div>

            <div className="px-0 pb-0">
              {shippingProgress !== null && shippingRemaining !== null && (
                <div className="px-3 pb-1">
                  {shippingRemaining > 0 ? (
                    <div className="flex items-center gap-2">
                      <span className="flex shrink-0 items-center gap-1 text-[10px] font-semibold text-emerald-600">
                        <Truck className="h-3 w-3" />
                        {formatPrice(shippingRemaining, currency)} more for FREE delivery
                      </span>
                      <div
                        className="h-1.5 flex-1 overflow-hidden rounded-full"
                        style={{ backgroundColor: "color-mix(in srgb, var(--storefront-text, inherit) 8%, transparent)" }}
                      >
                        <div
                          className="h-full rounded-full transition-[width] duration-500 ease-out"
                          style={{
                            width: `${shippingProgress}%`,
                            background: "linear-gradient(90deg, var(--storefront-primary, #10b981), color-mix(in srgb, var(--storefront-primary, #10b981) 70%, #34d399))",
                          }}
                        />
                      </div>
                    </div>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                      <Check className="h-3 w-3" /> 🎉 You qualify for FREE delivery!
                    </span>
                  )}
                </div>
              )}

              <CartTotalsFooter
                storeId={store.id}
                slug={store.slug}
                currency={currency}
                mrpTotal={mrpTotal}
                subtotal={cartTotal}
                couponDiscount={couponDiscount}
                onCheckout={closeCart}
              />
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
