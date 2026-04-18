/**
 * StorefrontHomeV19 — Quick Commerce Grocery home
 * Promo banner → Categories yellow grid → per-category 2-up product carousels with green section heads.
 */
import { useOutletContext, useParams, Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useStorefrontProducts } from "@/hooks/useStorefrontProducts";
import { ChevronRight, Tag } from "lucide-react";
import type { StoreData } from "@/layouts/StorefrontLayout";
import V19ProductCard from "@/components/storefront/v19/V19ProductCard";
import { storefrontPath } from "@/lib/subdomain";
import { optimizeImageUrl } from "@/lib/imageOptimize";

interface Category { id: string; name: string; slug: string; image_url: string | null; }

export default function StorefrontHomeV19() {
  const params = useParams<{ slug: string }>();
  const store = useOutletContext<StoreData>();
  const slug = params.slug || (store as any)?.slug || "";
  const queryClient = useQueryClient();
  const categories = (queryClient.getQueryData<Category[]>(["storefront-categories", store?.id]) || []) as Category[];
  const { products } = useStorefrontProducts(store?.id);

  if (!store) return null;

  // Group products by category name
  const productsByCategory = new Map<string, any[]>();
  for (const p of products) {
    const cat = (p as any).category || "Other";
    if (!productsByCategory.has(cat)) productsByCategory.set(cat, []);
    productsByCategory.get(cat)!.push(p);
  }

  // Show only categories that have products
  const visibleCategories = categories.filter((c) => productsByCategory.has(c.name));

  return (
    <div className="space-y-4">
      {/* Promo banner (uses store banner_url if present, else default yellow) */}
      <div className="v19-promo flex items-center justify-between gap-3">
        <div className="flex-1">
          <h2>{(store as any).description ? "Fresh deals" : "Pet Care supplies"}</h2>
          <h2 style={{ marginTop: 0 }}>in minutes</h2>
          <p>Food, treats, toys & more</p>
          <Link to={storefrontPath(slug, "shop")} className="cta">Order Now</Link>
        </div>
        {(store as any).banner_url && (
          <img
            src={optimizeImageUrl((store as any).banner_url, 300, 85)}
            alt=""
            className="w-32 h-32 object-contain"
          />
        )}
      </div>

      {/* Categories — yellow tile grid */}
      {categories.length > 0 && (
        <section>
          <h3 className="text-[20px] font-black text-gray-900 mb-3 px-1">Categories</h3>
          <div className="grid grid-cols-4 gap-2.5">
            {categories.map((cat) => (
              <Link key={cat.id} to={storefrontPath(slug, `category/${cat.slug}`)} className="v19-cat-tile">
                {cat.image_url ? (
                  <img
                    src={optimizeImageUrl(cat.image_url, 200, 85)}
                    alt={cat.name}
                    className="absolute inset-0 w-full h-full object-contain p-2"
                    loading="lazy"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Tag className="h-6 w-6 text-gray-700" />
                  </div>
                )}
                <div className="v19-cat-tile-label truncate">{cat.name}</div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Per-category product strips */}
      {visibleCategories.map((cat) => {
        const items = (productsByCategory.get(cat.name) || []).slice(0, 6);
        return (
          <section key={cat.id} className="space-y-3">
            <div className="v19-section-header">
              <span>{cat.name}</span>
              <Link to={storefrontPath(slug, `category/${cat.slug}`)}>
                View All <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1" style={{ scrollbarWidth: "none" }}>
              {items.map((p, i) => (
                <div key={p.id} className="flex-shrink-0 w-[46%]">
                  <V19ProductCard product={p} slug={slug} store={store} priority={i < 2} />
                </div>
              ))}
            </div>
          </section>
        );
      })}

      {/* Fallback: if no categorized products, show plain grid */}
      {visibleCategories.length === 0 && products.length > 0 && (
        <section>
          <div className="v19-section-header mb-3">
            <span>All Products</span>
            <Link to={storefrontPath(slug, "shop")}>View All <ChevronRight className="h-3.5 w-3.5" /></Link>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {products.slice(0, 8).map((p, i) => (
              <V19ProductCard key={p.id} product={p} slug={slug} store={store} priority={i < 2} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
