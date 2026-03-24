import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

interface WishlistItem {
  productId: string;
  name: string;
  price: number;
  salePrice?: number;
  image?: string;
  slug?: string;
  category?: string;
}

interface WishlistContextType {
  items: WishlistItem[];
  isWishlisted: (productId: string) => boolean;
  toggleWishlist: (item: WishlistItem) => void;
  removeFromWishlist: (productId: string) => void;
  wishlistCount: number;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

function getStorageKey(storeSlug: string) {
  return `wishlist_${storeSlug}`;
}

export function WishlistProvider({ children, slug }: { children: ReactNode; slug: string }) {
  const [items, setItems] = useState<WishlistItem[]>(() => {
    try {
      const stored = localStorage.getItem(getStorageKey(slug));
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(getStorageKey(slug), JSON.stringify(items));
  }, [items, slug]);

  const isWishlisted = useCallback((productId: string) => {
    return items.some((i) => i.productId === productId);
  }, [items]);

  const toggleWishlist = useCallback((item: WishlistItem) => {
    setItems((prev) => {
      const exists = prev.some((i) => i.productId === item.productId);
      if (exists) return prev.filter((i) => i.productId !== item.productId);
      return [...prev, item];
    });
  }, []);

  const removeFromWishlist = useCallback((productId: string) => {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  }, []);

  return (
    <WishlistContext.Provider value={{ items, isWishlisted, toggleWishlist, removeFromWishlist, wishlistCount: items.length }}>
      {children}
    </WishlistContext.Provider>
  );
}

const WISHLIST_FALLBACK: WishlistContextType = {
  items: [],
  isWishlisted: () => false,
  toggleWishlist: () => {},
  removeFromWishlist: () => {},
  wishlistCount: 0,
};

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  // Return safe fallback instead of throwing — prevents crashes when
  // components render briefly outside the provider (e.g. during error recovery)
  return ctx ?? WISHLIST_FALLBACK;
}
