import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { fbPixelTrack } from "@/hooks/useFacebookPixel";
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

export function CartProvider({ slug, children }: { slug: string; children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const stored = localStorage.getItem(getStorageKey(slug));
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [isCartOpen, setIsCartOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(getStorageKey(slug), JSON.stringify(items));
  }, [items, slug]);

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
    fbPixelTrack("AddToCart", {
      content_name: item.name,
      content_ids: [item.productId],
      content_type: "product",
      value: item.price,
      currency: "INR",
    });
    // Server-side CAPI - need store ID from slug
    try {
      const storeId = localStorage.getItem(`store_id_${slug}`);
      if (storeId) {
        fireMetaCAPI({
          storeId,
          eventName: "AddToCart",
          customData: {
            content_ids: [item.productId],
            content_type: "product",
            value: item.price,
            currency: "INR",
          },
        });
      }
    } catch {}
  }, [slug]);

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
  // Return safe fallback instead of throwing — prevents crashes when
  // components render briefly outside the provider (e.g. during error recovery)
  return ctx ?? CART_FALLBACK;
}
