import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react";

export interface CartItem {
  productId: string;
  variantId?: string;
  name: string;
  variantName?: string;
  price: number;
  image?: string;
  quantity: number;
  /** Optional line-item metadata (e.g. bundle expansion payload, upsell offer snapshot). */
  meta?: Record<string, any>;
}

interface CartContextType {
  items: CartItem[];
  addToCart: (item: Omit<CartItem, "quantity"> & { quantity?: number }, options?: { silent?: boolean }) => void;
  removeFromCart: (productId: string, variantId?: string) => void;
  updateQuantity: (productId: string, variantId: string | undefined, quantity: number) => void;
  clearCart: () => void;
  cartTotal: number;
  cartCount: number;
  isCartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  cartBounce: boolean;
  /**
   * Add/remove an automatic ₹0 gift line WITHOUT firing add-to-cart analytics.
   * Passing `null` removes the gift line for that product.
   */
  syncGiftLine: (productId: string, line: CartItem | null) => void;
}

const CartContext = createContext<CartContextType | null>(null);

function getStorageKey(slug: string) {
  return `cart_${slug}`;
}

/** Fire analytics asynchronously — never blocks addToCart */
function fireAddToCartAnalytics(
  item: { productId: string; variantId?: string; name: string; price: number },
  currency: string,
  storeId?: string
) {
  // Anti-ban guard: rapid taps on the same product within 1.5s collapse to
  // ONE pixel/CAPI event. Cart quantity still increments correctly — only the
  // tracking event is throttled. Prevents Meta from seeing event inflation.
  import("@/lib/pixelDedupe").then(({ shouldFirePixelEvent }) => {
    if (!shouldFirePixelEvent("AddToCart", item.productId, item.variantId)) return;
    // Never send synthetic bundle ids to Meta — they aren't in the catalog.
    const contentIds = String(item.productId).startsWith("bundle:")
      ? ((item as any)?.meta?.children || []).map((c: any) => c.productId).filter(Boolean)
      : [item.productId];
    if (contentIds.length === 0) return;


    // Dynamic imports keep fbPixelTrack + metaCapi out of the initial bundle
    Promise.all([
      import("@/hooks/useFacebookPixel"),
      import("@/lib/metaCapi"),
    ]).then(([pixelMod, capiMod]) => {
      const eid = pixelMod.generateEventId();
      pixelMod.fbPixelTrack("AddToCart", {
        content_name: item.name,
        content_ids: contentIds,
        content_type: "product",
        value: item.price,
        currency,
      }, eid);
      if (storeId) {
        capiMod.fireMetaCAPI({
          storeId,
          eventName: "AddToCart",
          eventId: eid,
          customData: {
            content_ids: contentIds,
            content_name: item.name,
            content_type: "product",
            value: item.price,
            currency,
          },
        });
      }
    }).catch(() => {});
  }).catch(() => {});
}

export function CartProvider({ slug, storeId, currency = "INR", children }: { slug: string; storeId?: string; currency?: string; children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [cartBounce, setCartBounce] = useState(false);

  // Deferred hydration from localStorage
  useEffect(() => {
    const hydrate = () => {
      try {
        const stored = localStorage.getItem(getStorageKey(slug));
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setItems(parsed);
          }
        }
      } catch {}
      setHydrated(true);
    };

    if ("requestIdleCallback" in window) {
      (window as any).requestIdleCallback(hydrate, { timeout: 200 });
    } else {
      setTimeout(hydrate, 0);
    }
  }, [slug]);

  // Persist to localStorage after hydration
  useEffect(() => {
    if (hydrated) {
      localStorage.setItem(getStorageKey(slug), JSON.stringify(items));
    }
  }, [items, slug, hydrated]);

  // Keep a live ref to items so openCart can read the latest cart without
  // listing `items` in its dep array (every quantity change would otherwise
  // re-create openCart → cascade-rerender every consumer across all 20 themes).
  const itemsRef = useRef(items);
  useEffect(() => { itemsRef.current = items; }, [items]);

  const openCart = useCallback(() => {
    setIsCartOpen(true);
    // Fire ViewCart only on user-initiated cart opens, throttled per cart-content
    // hash + 30 min window so repeated icon clicks don't spam Meta with duplicates
    // (Shopify behaves the same — one ViewCart per "session of looking at cart").
    const currentItems = itemsRef.current;
    if (storeId && currentItems.length > 0) {
      try {
        const hash = currentItems.map((i) => `${i.productId}:${i.quantity}`).sort().join("|");
        const key = `vc_${storeId}`;
        const raw = sessionStorage.getItem(key);
        const now = Date.now();
        if (raw) {
          const [prevHash, prevTs] = raw.split("@");
          if (prevHash === hash && now - Number(prevTs) < 30 * 60 * 1000) return;
        }
        sessionStorage.setItem(key, `${hash}@${now}`);
      } catch {}
      // Storefront funnel event — session-unique cart_view.
      import("@/lib/storefrontEvents").then(m => m.fireStorefrontEvent({
        storeId,
        eventName: "cart_view",
        value: currentItems.reduce((s, i) => s + i.price * i.quantity, 0),
        currency,
        metadata: { num_items: currentItems.reduce((s, i) => s + i.quantity, 0) },
      })).catch(() => {});
      Promise.all([
        import("@/hooks/useFacebookPixel"),
        import("@/lib/metaCapi"),
      ]).then(([pixelMod, capiMod]) => {
        const eid = pixelMod.generateEventId();
        const value = currentItems.reduce((s, i) => s + i.price * i.quantity, 0);
        // Synthetic `bundle:<uuid>` ids don't exist in the Meta catalog and
        // tank the catalog match rate — expand them to their real children.
        const flat = currentItems
          .flatMap((i: any) =>
            i?.meta?.kind === "bundle" && Array.isArray(i.meta?.children)
              ? i.meta.children.map((c: any) => ({
                  id: c.productId,
                  quantity: i.quantity,
                  item_price: Number((i.price / Math.max(1, i.meta.children.length)).toFixed(2)),
                }))
              : [{ id: i.productId, quantity: i.quantity, item_price: i.price }]
          )
          .filter((f) => f.id && !String(f.id).startsWith("bundle:"));
        const data = {
          content_ids: flat.map((f) => f.id),
          contents: flat,
          content_type: "product",
          num_items: currentItems.reduce((s, i) => s + i.quantity, 0),
          value,
          currency,
        };
        pixelMod.fbPixelTrack("ViewCart", data, eid);
        // CAPI skipped for ViewCart — non-standard Meta event, no algo value, ~15% edge-call reduction.
        // Pixel still fires browser-side for analytics. Money events (VC/ATC/IC/Purchase) keep dual-fire.
        void capiMod;
      }).catch(() => {});
    }
  }, [storeId, currency]);
  const closeCart = useCallback(() => setIsCartOpen(false), []);

  // Open the side cart once the fly-to-cart arc lands (skip on cart/checkout
  // pages, where the drawer would cover the page the user is already on).
  useEffect(() => {
    const onLanded = () => {
      const p = window.location.pathname;
      if (/\/(cart|checkout)(\/|$)/.test(p)) return;
      setIsCartOpen(true);
    };
    window.addEventListener("cart:fly-landed", onLanded as EventListener);
    return () => window.removeEventListener("cart:fly-landed", onLanded as EventListener);
  }, []);



  const addToCart = useCallback((item: Omit<CartItem, "quantity"> & { quantity?: number }, options?: { silent?: boolean }) => {
    setItems((prev) => {
      const idx = prev.findIndex(
        (i) => i.productId === item.productId && i.variantId === item.variantId
      );
      if (idx >= 0) {
        const updated = [...prev];
        const existing = updated[idx];
        // Packaging upgrade: the same product+variant added again with a
        // different gift-box choice must not keep the stale packaging (that
        // charged/refunded the surcharge for every unit in the line).
        // Apply the newest selection to the whole merged line so the price
        // shown, stored meta and server-side surcharge always agree.
        const packagingChanged =
          (existing.meta?.kind === "packaging" || item.meta?.kind === "packaging") &&
          (existing.meta?.packaging ?? null) !== (item.meta?.packaging ?? null);
        updated[idx] = {
          ...existing,
          ...(packagingChanged ? { price: item.price, meta: item.meta } : {}),
          quantity: existing.quantity + (item.quantity || 1),
        };
        return updated;
      }

      return [...prev, { ...item, quantity: item.quantity || 1 }];
    });
    if (!options?.silent) setIsCartOpen(true);
    // Trigger cart bounce animation
    setCartBounce(true);
    setTimeout(() => setCartBounce(false), 500);
    // Fire global "+1" event for floating badge overlay
    if (typeof window !== "undefined") {
      try { window.dispatchEvent(new CustomEvent("cart:add", { detail: { productId: item.productId } })); } catch {}
    }
    fireAddToCartAnalytics(item, currency, storeId);
    if (storeId) {
      import("@/lib/storefrontEvents").then(m => m.fireStorefrontEvent({
        storeId,
        eventName: "add_to_cart",
        productId: item.productId,
        value: item.price,
        currency,
      })).catch(() => {});
    }
    // GA4 add_to_cart — for GA4 ecommerce funnels + Google Ads.
    try {
      import("@/hooks/useGA4").then((m) => m.ga4Track("add_to_cart", {
        currency,
        value: item.price * (item.quantity || 1),
        items: [{ item_id: item.productId, item_name: item.name, item_variant: item.variantId, price: item.price, quantity: item.quantity || 1 }],
      })).catch(() => {});
    } catch {}
  }, [slug, storeId, currency]);

  const removeFromCart = useCallback((productId: string, variantId?: string) => {
    setItems((prev) => {
      const removed = prev.find((i) => i.productId === productId && i.variantId === variantId);
      if (removed && storeId) {
        import("@/lib/storefrontEvents").then(m => m.fireStorefrontEvent({
          storeId,
          eventName: "cart_remove",
          productId,
          value: removed.price,
          currency,
          metadata: { qty: removed.quantity, variantId: variantId || null },
        })).catch(() => {});
      }
      return prev.filter((i) => !(i.productId === productId && i.variantId === variantId));
    });
  }, [storeId, currency]);

  const updateQuantity = useCallback((productId: string, variantId: string | undefined, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId, variantId);
      return;
    }
    setItems((prev) => {
      const cur = prev.find((i) => i.productId === productId && i.variantId === variantId);
      if (cur && storeId && cur.quantity !== quantity) {
        import("@/lib/storefrontEvents").then(m => m.fireStorefrontEvent({
          storeId,
          eventName: "cart_qty_change",
          productId,
          metadata: { from: cur.quantity, to: quantity, variantId: variantId || null },
        })).catch(() => {});
      }
      return prev.map((i) =>
        i.productId === productId && i.variantId === variantId ? { ...i, quantity } : i
      );
    });
  }, [removeFromCart, storeId]);

  const clearCart = useCallback(() => setItems([]), []);

  // Free-gift line sync (threshold reached / dropped). Silent by design: a ₹0
  // auto-added gift is not a shopper add-to-cart action, so no pixel events.
  const syncGiftLine = useCallback((productId: string, line: CartItem | null) => {
    setItems((prev) => {
      const isGift = (i: CartItem) => i.productId === productId && i.meta?.kind === "upsell" && i.meta?.auto_gift === true;
      const existing = prev.find(isGift);
      if (!line) return existing ? prev.filter((i) => !isGift(i)) : prev;
      if (existing) return prev;
      // Never duplicate a product the shopper already bought at full price.
      if (prev.some((i) => i.productId === productId && !isGift(i))) return prev;
      return [...prev, line];
    });
  }, []);

  const cartTotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const cartCount = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, addToCart, removeFromCart, updateQuantity, clearCart, cartTotal, cartCount, isCartOpen, openCart, closeCart, cartBounce, syncGiftLine }}>
      {children}
    </CartContext.Provider>
  );
}

const CART_FALLBACK: CartContextType = {
  items: [],
  addToCart: () => {},
  removeFromCart: () => {},
  updateQuantity: () => {},
  clearCart: () => {},
  cartTotal: 0,
  cartCount: 0,
  isCartOpen: false,
  openCart: () => {},
  closeCart: () => {},
  cartBounce: false,
  syncGiftLine: () => {},
};

export function useCart() {
  const ctx = useContext(CartContext);
  return ctx ?? CART_FALLBACK;
}
