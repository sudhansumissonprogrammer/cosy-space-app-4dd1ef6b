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
  // Start empty — defer localStorage read to avoid blocking first paint
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

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

  // Persist after hydration
  useEffect(() => {
    if (hydrated) {
      localStorage.setItem(getStorageKey(slug), JSON.stringify(items));
    }
  }, [items, slug, hydrated]);

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
  return ctx ?? WISHLIST_FALLBACK;
}
