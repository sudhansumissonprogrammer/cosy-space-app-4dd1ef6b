import { useState, useMemo, useRef, useCallback } from "react";
import { useOutletContext } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useStorefrontThemeConfig } from "@/hooks/useStorefrontThemeConfig";
import { Minus, Plus, Search, UtensilsCrossed } from "lucide-react";
import type { StoreData } from "@/layouts/StorefrontLayout";
import { useCart } from "@/contexts/CartContext";
import { useStoreJsonLd } from "@/hooks/useJsonLd";
import { optimizeImageUrl } from "@/lib/imageOptimize";

/* ── Veg / Non-Veg indicator ── */
function DietBadge({ category }: { category: string | null }) {
  if (!category) return null;
  const lower = category.toLowerCase();
  const isVeg = lower.includes("veg") && !lower.includes("non-veg");
  const isNonVeg = lower.includes("non-veg") || lower.includes("nonveg");
  if (!isVeg && !isNonVeg) return null;

  return (
    <div
      className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border"
      style={{ borderColor: isVeg ? "#22c55e" : "#ef4444" }}
    >
      <div
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: isVeg ? "#22c55e" : "#ef4444" }}
      />
    </div>
  );
}

/* ── Menu Item Card ── */
function MenuItemCard({
  product,
  currency,
}: {
  product: any;
  currency: string;
}) {
  const { items, addToCart, updateQuantity } = useCart();
  const existing = items.find(
    (i) => i.productId === product.id && !i.variantId
  );
  const qty = existing?.quantity || 0;

  const price = product.sale_price || product.price;
  const originalPrice = product.sale_price ? product.price : null;
  const hasDiscount = originalPrice && originalPrice > price;

  const handleAdd = useCallback(() => {
    addToCart({
      productId: product.id,
      name: product.name,
      price,
      image: product.image_url,
      quantity: 1,
    });
  }, [addToCart, product, price]);

  const handleIncrease = useCallback(() => {
    updateQuantity(product.id, undefined, qty + 1);
  }, [updateQuantity, product.id, qty]);

  const handleDecrease = useCallback(() => {
    updateQuantity(product.id, undefined, qty - 1);
  }, [updateQuantity, product.id, qty]);

  return (
    <div
      className="flex gap-3 rounded-2xl p-3 transition-all"
      style={{
        backgroundColor: "var(--storefront-text, #1a1a1a)06",
        border: "1px solid var(--storefront-text, #1a1a1a)08",
      }}
    >
      {/* Image */}
      {product.image_url && (
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl">
          <img
            src={optimizeImageUrl(product.image_url, 200)}
            alt={product.name}
            className="h-full w-full object-cover"
            loading="lazy"
          />
          {hasDiscount && (
            <div className="absolute left-1 top-1 rounded-md bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
              {Math.round(((originalPrice - price) / originalPrice) * 100)}% OFF
            </div>
          )}
        </div>
      )}

      {/* Details */}
      <div className="flex flex-1 flex-col justify-between gap-1 py-0.5">
        <div>
          <div className="flex items-center gap-1.5">
            <DietBadge category={product.category} />
            <h3
              className="text-sm font-semibold leading-tight line-clamp-2"
              style={{
                color: "var(--storefront-text, #1a1a1a)",
                fontFamily: "var(--storefront-heading-font, inherit)",
              }}
            >
              {product.name}
            </h3>
          </div>
          {product.description && (
            <p
              className="mt-0.5 text-xs leading-snug line-clamp-2 opacity-50"
              style={{ color: "var(--storefront-text, #1a1a1a)" }}
            >
              {product.description}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-1.5">
            <span
              className="text-sm font-bold"
              style={{ color: "var(--storefront-text, #1a1a1a)" }}
            >
              {currency}{price.toLocaleString()}
            </span>
            {hasDiscount && (
              <span className="text-xs line-through opacity-40">
                {currency}{originalPrice.toLocaleString()}
              </span>
            )}
          </div>

          {/* Quantity Controls */}
          {qty === 0 ? (
            <button
              onClick={handleAdd}
              className="rounded-xl px-4 py-1.5 text-xs font-bold transition-all active:scale-95"
              style={{
                backgroundColor: "#25D36615",
                color: "#25D366",
                border: "1.5px solid #25D36640",
              }}
            >
              ADD
            </button>
          ) : (
            <div
              className="flex items-center gap-0 rounded-xl overflow-hidden"
              style={{
                backgroundColor: "#25D366",
                color: "#ffffff",
              }}
            >
              <button
                onClick={handleDecrease}
                className="flex h-8 w-8 items-center justify-center transition-all active:scale-90"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="flex h-8 w-6 items-center justify-center text-xs font-bold">
                {qty}
              </span>
              <button
                onClick={handleIncrease}
                className="flex h-8 w-8 items-center justify-center transition-all active:scale-90"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Category Tabs ── */
function CategoryTabs({
  categories,
  activeCategory,
  onSelect,
}: {
  categories: string[];
  activeCategory: string;
  onSelect: (cat: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={scrollRef}
      className="flex gap-2 overflow-x-auto px-4 py-3 scrollbar-hide"
      style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
    >
      {categories.map((cat) => {
        const isActive = cat === activeCategory;
        return (
          <button
            key={cat}
            onClick={() => onSelect(cat)}
            className="shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition-all active:scale-95"
            style={{
              backgroundColor: isActive ? "#25D366" : "var(--storefront-text, #1a1a1a)08",
              color: isActive ? "#ffffff" : "var(--storefront-text, #1a1a1a)90",
              border: isActive ? "none" : "1px solid var(--storefront-text, #1a1a1a)12",
            }}
          >
            {cat}
          </button>
        );
      })}
    </div>
  );
}

/* ── Search Bar ── */
function MenuSearchBar({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="px-4 pt-3">
      <div
        className="flex items-center gap-2 rounded-xl px-3 py-2.5"
        style={{
          backgroundColor: "var(--storefront-text, #1a1a1a)06",
          border: "1px solid var(--storefront-text, #1a1a1a)10",
        }}
      >
        <Search
          className="h-4 w-4 shrink-0 opacity-40"
          style={{ color: "var(--storefront-text, #1a1a1a)" }}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search menu..."
          className="flex-1 bg-transparent text-sm outline-none placeholder:opacity-40"
          style={{ color: "var(--storefront-text, #1a1a1a)" }}
        />
      </div>
    </div>
  );
}

/* ── Main Home Page ── */
export default function StorefrontHomeV13() {
  const store = useOutletContext<StoreData & { tableNumber?: string }>();
  const queryClient = useQueryClient();
  const themeConfig = useStorefrontThemeConfig(store?.id);

  const products =
    (queryClient.getQueryData<any[]>(["storefront-products", store?.id]) || []).filter(
      (p: any) => p.is_active
    );

  useStoreJsonLd({
    storeName: store?.name,
    storeSlug: store?.slug,
    description: store?.description || undefined,
    logo: store?.logo_url || undefined,
    location: (store as any)?.location || undefined,
    whatsappNumber: (store as any)?.whatsapp_number || undefined,
  });

  const [searchQuery, setSearchQuery] = useState("");

  // Build category list from products
  const allCategories = useMemo(() => {
    const cats = new Set<string>();
    cats.add("All");
    products.forEach((p: any) => {
      if (p.category) cats.add(p.category);
    });
    return Array.from(cats);
  }, [products]);

  const [activeCategory, setActiveCategory] = useState("All");

  // Filter products
  const filteredProducts = useMemo(() => {
    let result = products;
    if (activeCategory !== "All") {
      result = result.filter((p: any) => p.category === activeCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p: any) =>
          p.name.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [products, activeCategory, searchQuery]);

  // Group by category for section display
  const groupedProducts = useMemo(() => {
    if (activeCategory !== "All") {
      return [{ category: activeCategory, items: filteredProducts }];
    }
    const groups: { category: string; items: any[] }[] = [];
    const catMap = new Map<string, any[]>();
    filteredProducts.forEach((p: any) => {
      const cat = p.category || "Other";
      if (!catMap.has(cat)) catMap.set(cat, []);
      catMap.get(cat)!.push(p);
    });
    catMap.forEach((items, category) => {
      groups.push({ category, items });
    });
    return groups;
  }, [filteredProducts, activeCategory]);

  const currency = (store as any)?.currency === "USD" ? "$" : "₹";

  return (
    <div className="min-h-screen">
      {/* Search */}
      <MenuSearchBar value={searchQuery} onChange={setSearchQuery} />

      {/* Category Tabs */}
      {allCategories.length > 1 && (
        <CategoryTabs
          categories={allCategories}
          activeCategory={activeCategory}
          onSelect={setActiveCategory}
        />
      )}

      {/* Menu Items */}
      <div className="px-4 pb-4">
        {groupedProducts.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 opacity-50">
            <UtensilsCrossed className="h-10 w-10" />
            <p className="text-sm font-medium">No items found</p>
          </div>
        )}

        {groupedProducts.map((group) => (
          <div key={group.category} className="mb-6">
            {activeCategory === "All" && (
              <h2
                className="mb-3 text-base font-bold tracking-tight"
                style={{
                  color: "var(--storefront-text, #1a1a1a)",
                  fontFamily: "var(--storefront-heading-font, inherit)",
                }}
              >
                {group.category}
              </h2>
            )}
            <div className="flex flex-col gap-2.5">
              {group.items.map((product: any) => (
                <MenuItemCard
                  key={product.id}
                  product={product}
                  currency={currency}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
