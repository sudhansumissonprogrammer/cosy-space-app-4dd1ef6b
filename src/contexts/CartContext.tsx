import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

export interface CartItem {
  productId: string;
  variantId?: string;
  name: string;
  variantName?: string;
  price: number;
  image?: string;
  quantity: number;
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
}

const CartContext = createContext<CartContextType | null>(null);

function getStorageKey(slug: string) {
  return `cart_${slug}`;
}

/** Fire analytics asynchronously — never blocks addToCart */
function fireAddToCartAnalytics(
  item: { productId: string; name: string; price: number },
  currency: string,
  storeId?: string
) {
  // Dynamic imports keep fbPixelTrack + metaCapi out of the initial bundle
  Promise.all([
    import("@/hooks/useFacebookPixel"),
    import("@/lib/metaCapi"),
  ]).then(([pixelMod, capiMod]) => {
    const eid = pixelMod.generateEventId();
    pixelMod.fbPixelTrack("AddToCart", {
      content_name: item.name,
      content_ids: [item.productId],
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
          content_ids: [item.productId],
          content_type: "product",
          value: item.price,
          currency,
        },
      });
    }
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

  const openCart = useCallback(() => setIsCartOpen(true), []);
  const closeCart = useCallback(() => setIsCartOpen(false), []);

  const addToCart = useCallback((item: Omit<CartItem, "quantity"> & { quantity?: number }, options?: { silent?: boolean }) => {
    setItems((prev) => {
      const idx = prev.findIndex(
        (i) => i.productId === item.productId && i.variantId === item.variantId
      );
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], quantity: updated[idx].quantity + (item.quantity || 1) };
        return updated;
      }
      return [...prev, { ...item, quantity: item.quantity || 1 }];
    });
    if (!options?.silent) setIsCartOpen(true);
    // Trigger cart bounce animation
    setCartBounce(true);
    setTimeout(() => setCartBounce(false), 500);
    fireAddToCartAnalytics(item, currency, storeId);
  }, [slug, storeId, currency]);

  const removeFromCart = useCallback((productId: string, variantId?: string) => {
    setItems((prev) => prev.filter((i) => !(i.productId === productId && i.variantId === variantId)));
  }, []);

  const updateQuantity = useCallback((productId: string, variantId: string | undefined, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId, variantId);
      return;
    }
    setItems((prev) =>
      prev.map((i) =>
        i.productId === productId && i.variantId === variantId ? { ...i, quantity } : i
      )
    );
  }, [removeFromCart]);

  const clearCart = useCallback(() => setItems([]), []);

  const cartTotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const cartCount = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, addToCart, removeFromCart, updateQuantity, clearCart, cartTotal, cartCount, isCartOpen, openCart, closeCart, cartBounce }}>
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
};

export function useCart() {
  const ctx = useContext(CartContext);
  return ctx ?? CART_FALLBACK;
}
