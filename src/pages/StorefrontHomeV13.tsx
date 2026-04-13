import { useState, useMemo, useRef, useCallback, lazy, Suspense } from "react";
import { useOutletContext } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useStorefrontThemeConfig } from "@/hooks/useStorefrontThemeConfig";
import { useStorefrontProducts } from "@/hooks/useStorefrontProducts";
import { Minus, Plus, Search, UtensilsCrossed, SlidersHorizontal, X, ChevronDown } from "lucide-react";
import type { StoreData } from "@/layouts/StorefrontLayout";
import { useCart } from "@/contexts/CartContext";
import { useStoreJsonLd } from "@/hooks/useJsonLd";
import { optimizeImageUrl } from "@/lib/imageOptimize";
import UniversalProductCard from "@/components/storefront/UniversalProductCard";
import UniversalCategories from "@/components/storefront/UniversalCategories";
const StorefrontInstagramSection = lazy(() => import("@/components/storefront/StorefrontInstagramSection"));

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

/* ── Menu Item Card (style-4 inline) ── */
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

          {qty === 0 ? (
            <button
              onClick={handleAdd}
              className="rounded-xl px-4 py-1.5 text-xs font-bold transition-all active:scale-95"
              style={{
                backgroundColor: "color-mix(in srgb, var(--storefront-primary, #25D366) 8%, transparent)",
                color: "var(--storefront-primary, #25D366)",
                border: "1.5px solid color-mix(in srgb, var(--storefront-primary, #25D366) 25%, transparent)",
              }}
            >
              ADD
            </button>
          ) : (
            <div
              className="flex items-center gap-0 rounded-xl overflow-hidden"
              style={{ backgroundColor: "var(--storefront-primary, #25D366)", color: "var(--storefront-btn-text, #ffffff)" }}
            >
              <button onClick={handleDecrease} className="flex h-8 w-8 items-center justify-center transition-all active:scale-90">
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="flex h-8 w-6 items-center justify-center text-xs font-bold">{qty}</span>
              <button onClick={handleIncrease} className="flex h-8 w-8 items-center justify-center transition-all active:scale-90">
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
  return (
    <div
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

/* ── Enhanced Search Bar with Filter + Autofill ── */
type SortOption = "default" | "price-asc" | "price-desc" | "name-asc";
type DietFilter = "all" | "veg" | "non-veg";

function MenuSearchBar({
  value,
  onChange,
  products,
  sortBy,
  onSortChange,
  dietFilter,
  onDietChange,
}: {
  value: string;
  onChange: (v: string) => void;
  products: any[];
  sortBy: SortOption;
  onSortChange: (v: SortOption) => void;
  dietFilter: DietFilter;
  onDietChange: (v: DietFilter) => void;
}) {
  const [showFilters, setShowFilters] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = useMemo(() => {
    if (!value.trim()) return [];
    const q = value.toLowerCase();
    return products
      .filter(
        (p: any) =>
          p.name.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q)
      )
      .slice(0, 5);
  }, [value, products]);

  const activeFilterCount =
    (sortBy !== "default" ? 1 : 0) + (dietFilter !== "all" ? 1 : 0);

  return (
    <div className="px-4 pt-3 relative">
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
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          placeholder="Search menu..."
          className="flex-1 bg-transparent text-sm outline-none placeholder:opacity-40"
          style={{ color: "var(--storefront-text, #1a1a1a)" }}
        />
        {value && (
          <button onClick={() => { onChange(""); setShowSuggestions(false); }}>
            <X className="h-4 w-4 opacity-40" style={{ color: "var(--storefront-text, #1a1a1a)" }} />
          </button>
        )}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="relative flex h-7 w-7 items-center justify-center rounded-lg transition-all"
          style={{
            backgroundColor: showFilters || activeFilterCount > 0 ? "color-mix(in srgb, var(--storefront-primary, #25D366) 12%, transparent)" : "transparent",
          }}
        >
          <SlidersHorizontal className="h-4 w-4" style={{ color: activeFilterCount > 0 ? "var(--storefront-primary, #25D366)" : "color-mix(in srgb, var(--storefront-text, #1a1a1a) 50%, transparent)" }} />
          {activeFilterCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8px] font-bold" style={{ backgroundColor: "var(--storefront-primary, #25D366)", color: "var(--storefront-btn-text, #fff)" }}>
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Autofill Suggestions */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          className="absolute left-4 right-4 z-50 mt-1 overflow-hidden rounded-xl shadow-lg"
          style={{
            backgroundColor: "var(--storefront-bg, #ffffff)",
            border: "1px solid var(--storefront-text, #1a1a1a)15",
          }}
        >
          {suggestions.map((p: any) => (
            <button
              key={p.id}
              className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-all hover:opacity-80"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(p.name);
                setShowSuggestions(false);
              }}
              style={{ borderBottom: "1px solid var(--storefront-text, #1a1a1a)08" }}
            >
              {p.image_url && (
                <img src={optimizeImageUrl(p.image_url, 80)} alt="" className="h-8 w-8 rounded-lg object-cover" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate" style={{ color: "var(--storefront-text, #1a1a1a)" }}>
                  {p.name}
                </p>
                <p className="text-[10px] opacity-50" style={{ color: "var(--storefront-text, #1a1a1a)" }}>
                  {p.category || ""}
                </p>
              </div>
              <span className="text-xs font-bold" style={{ color: "var(--storefront-text, #1a1a1a)" }}>
                {(p.sale_price || p.price).toLocaleString()}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Filter Panel */}
      {showFilters && (
        <div
          className="mt-2 rounded-xl p-3 space-y-3"
          style={{
            backgroundColor: "var(--storefront-text, #1a1a1a)04",
            border: "1px solid var(--storefront-text, #1a1a1a)10",
          }}
        >
          {/* Sort */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider opacity-50 mb-1.5" style={{ color: "var(--storefront-text, #1a1a1a)" }}>
              Sort by
            </p>
            <div className="flex flex-wrap gap-1.5">
              {([
                { value: "default" as SortOption, label: "Default" },
                { value: "price-asc" as SortOption, label: "Price ↑" },
                { value: "price-desc" as SortOption, label: "Price ↓" },
                { value: "name-asc" as SortOption, label: "Name A-Z" },
              ] as const).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => onSortChange(opt.value)}
                  className="rounded-full px-3 py-1 text-[11px] font-semibold transition-all"
                  style={{
                    backgroundColor: sortBy === opt.value ? "#25D366" : "var(--storefront-text, #1a1a1a)08",
                    color: sortBy === opt.value ? "#fff" : "var(--storefront-text, #1a1a1a)80",
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Diet Filter */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider opacity-50 mb-1.5" style={{ color: "var(--storefront-text, #1a1a1a)" }}>
              Diet
            </p>
            <div className="flex flex-wrap gap-1.5">
              {([
                { value: "all" as DietFilter, label: "All" },
                { value: "veg" as DietFilter, label: "🟢 Veg" },
                { value: "non-veg" as DietFilter, label: "🔴 Non-Veg" },
              ] as const).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => onDietChange(opt.value)}
                  className="rounded-full px-3 py-1 text-[11px] font-semibold transition-all"
                  style={{
                    backgroundColor: dietFilter === opt.value ? "#25D366" : "var(--storefront-text, #1a1a1a)08",
                    color: dietFilter === opt.value ? "#fff" : "var(--storefront-text, #1a1a1a)80",
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {activeFilterCount > 0 && (
            <button
              onClick={() => { onSortChange("default"); onDietChange("all"); }}
              className="text-[11px] font-semibold underline opacity-60"
              style={{ color: "var(--storefront-text, #1a1a1a)" }}
            >
              Clear all filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Main Home Page ── */
export default function StorefrontHomeV13() {
  const store = useOutletContext<StoreData & { tableNumber?: string }>();
  const queryClient = useQueryClient();
  const themeConfig = useStorefrontThemeConfig(store?.id);

  const { products: rawProducts } = useStorefrontProducts(store?.id);
  const products = rawProducts.filter((p: any) => p.is_active);

  const categories = queryClient.getQueryData<any[]>(["storefront-categories", store?.id]) || [];

  useStoreJsonLd({
    storeName: store?.name,
    storeSlug: store?.slug,
    description: store?.description || undefined,
    logo: store?.logo_url || undefined,
    location: (store as any)?.location || undefined,
    whatsappNumber: (store as any)?.whatsapp_number || undefined,
    customDomain: (store as any)?.custom_domain || undefined,
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("default");
  const [dietFilter, setDietFilter] = useState<DietFilter>("all");

  const cardStyle = (themeConfig as any)?.product_card_style || "style-4";
  const categoryStyle = (themeConfig as any)?.category_style || "style-5";
  const isMenuStyle = cardStyle === "style-4";

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

  // Filter + sort products
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

    // Diet filter
    if (dietFilter === "veg") {
      result = result.filter((p: any) => {
        const cat = (p.category || "").toLowerCase();
        return cat.includes("veg") && !cat.includes("non-veg") && !cat.includes("nonveg");
      });
    } else if (dietFilter === "non-veg") {
      result = result.filter((p: any) => {
        const cat = (p.category || "").toLowerCase();
        return cat.includes("non-veg") || cat.includes("nonveg");
      });
    }

    // Sort
    if (sortBy === "price-asc") {
      result = [...result].sort((a, b) => (a.sale_price || a.price) - (b.sale_price || b.price));
    } else if (sortBy === "price-desc") {
      result = [...result].sort((a, b) => (b.sale_price || b.price) - (a.sale_price || a.price));
    } else if (sortBy === "name-asc") {
      result = [...result].sort((a, b) => a.name.localeCompare(b.name));
    }

    return result;
  }, [products, activeCategory, searchQuery, dietFilter, sortBy]);

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
      {/* Universal Categories (if images exist and not pill/text-only) */}
      {categories.length > 0 && categoryStyle !== "style-5" && (
        <div className="pt-3">
          <UniversalCategories
            categories={categories}
            storeSlug={store?.slug}
            categoryStyle={categoryStyle}
          />
        </div>
      )}

      {/* Search + Filters */}
      <MenuSearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        products={products}
        sortBy={sortBy}
        onSortChange={setSortBy}
        dietFilter={dietFilter}
        onDietChange={setDietFilter}
      />

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

            {isMenuStyle ? (
              <div className="flex flex-col gap-2.5">
                {group.items.map((product: any) => (
                  <MenuItemCard
                    key={product.id}
                    product={product}
                    currency={currency}
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-1.5 sm:gap-4 sm:grid-cols-3">
                {group.items.map((product: any) => (
                  <UniversalProductCard
                    key={product.id}
                    product={product}
                    slug={store?.slug}
                    store={store as any}
                    cardStyle={cardStyle}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <Suspense fallback={null}>
        <StorefrontInstagramSection store={store} />
      </Suspense>
    </div>
  );
}
