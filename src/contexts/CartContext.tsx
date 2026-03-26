import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { fbPixelTrack, generateEventId } from "@/hooks/useFacebookPixel";
import { fireMetaCAPI } from "@/lib/metaCapi";

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
  addToCart: (item: Omit<CartItem, "quantity"> & { quantity?: number }) => void;
  removeFromCart: (productId: string, variantId?: string) => void;
  updateQuantity: (productId: string, variantId: string | undefined, quantity: number) => void;
  clearCart: () => void;
  cartTotal: number;
  cartCount: number;
  isCartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
}

const CartContext = createContext<CartContextType | null>(null);

function getStorageKey(slug: string) {
  return `cart_${slug}`;
}

export function CartProvider({ slug, storeId, children }: { slug: string; storeId?: string; children: ReactNode }) {
  // Start empty — defer localStorage read to avoid blocking first paint
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);

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

  const addToCart = useCallback((item: Omit<CartItem, "quantity"> & { quantity?: number }) => {
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
    setIsCartOpen(true);
    const eid = generateEventId();
    fbPixelTrack("AddToCart", {
      content_name: item.name,
      content_ids: [item.productId],
      content_type: "product",
      value: item.price,
      currency: "INR",
    }, eid);
    if (storeId) {
      fireMetaCAPI({
        storeId,
        eventName: "AddToCart",
        eventId: eid,
        customData: {
          content_ids: [item.productId],
          content_type: "product",
          value: item.price,
          currency: "INR",
        },
      });
    }
  }, [slug, storeId]);

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
    <CartContext.Provider value={{ items, addToCart, removeFromCart, updateQuantity, clearCart, cartTotal, cartCount, isCartOpen, openCart, closeCart }}>
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
};

export function useCart() {
  const ctx = useContext(CartContext);
  return ctx ?? CART_FALLBACK;
}
