/**
 * StorefrontHomeV19 — Blinkit-style home: swipeable promo carousel, circular pastel categories, plain section titles.
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

const PASTELS = ["#FFF1D6", "#FFE5E5", "#DDEBFF", "#E5F7E5", "#FFE7F3", "#F0E5FF", "#FFF7CC", "#D6F5F0"];

const PROMO_CARDS = [
  { bg: "linear-gradient(135deg, #FFD33D 0%, #FFC107 100%)", title: "Fresh deals", subtitle: "in minutes" },
  { bg: "linear-gradient(135deg, #FFB7C5 0%, #FF8FA3 100%)", title: "Snack attack", subtitle: "30% off today" },
  { bg: "linear-gradient(135deg, #B8E6C1 0%, #7DD3A0 100%)", title: "Daily essentials", subtitle: "starting ₹19" },
  { bg: "linear-gradient(135deg, #C5DDFF 0%, #8FB5FF 100%)", title: "New arrivals", subtitle: "fresh stock daily" },
];

export default function StorefrontHomeV19() {
  const params = useParams<{ slug: string }>();
  const store = useOutletContext<StoreData>();
  const slug = params.slug || (store as any)?.slug || "";
  const queryClient = useQueryClient();
  const categories = (queryClient.getQueryData<Category[]>(["storefront-categories", store?.id]) || []) as Category[];
  const { products } = useStorefrontProducts(store?.id);

  if (!store) return null;

  const productsByCategory = new Map<string, any[]>();
  for (const p of products) {
    const cat = (p as any).category || "Other";
    if (!productsByCategory.has(cat)) productsByCategory.set(cat, []);
    productsByCategory.get(cat)!.push(p);
  }
  const visibleCategories = categories.filter((c) => productsByCategory.has(c.name));

  return (
    <div className="space-y-5 pb-4">
      {/* Promo carousel — swipeable */}
      <div className="-mx-1 overflow-x-auto scrollbar-hide">
        <div className="flex gap-3 px-1 snap-x snap-mandatory">
          {PROMO_CARDS.map((promo, i) => (
            <div
              key={i}
              className="v19-promo-card snap-start"
              style={{ background: promo.bg }}
            >
              <div>
                <h2>{promo.title}</h2>
                <h2 style={{ marginTop: 0 }}>{promo.subtitle}</h2>
                <p>Tap to explore</p>
              </div>
              <Link to={storefrontPath(slug, "shop")} className="cta">Shop Now</Link>
            </div>
          ))}
        </div>
      </div>

      {/* Categories — circular pastel */}
      {categories.length > 0 && (
        <section>
          <div className="v19-section-title">
            <h3>Shop by category</h3>
            <Link to={storefrontPath(slug, "categories")}>see all <ChevronRight className="h-3 w-3" /></Link>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {categories.slice(0, 8).map((cat, i) => (
              <Link key={cat.id} to={storefrontPath(slug, `category/${cat.slug}`)} className="v19-cat-circle">
                <div className="circle" style={{ background: PASTELS[i % PASTELS.length] }}>
                  {cat.image_url ? (
                    <img
                      src={optimizeImageUrl(cat.image_url, 200, 85)}
                      alt={cat.name}
                      className="absolute inset-0 w-full h-full object-contain p-1.5"
                      loading="lazy"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Tag className="h-6 w-6 text-gray-700" />
                    </div>
                  )}
                </div>
                <span className="label line-clamp-2">{cat.name}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Per-category horizontal product strips */}
      {visibleCategories.map((cat) => {
        const items = (productsByCategory.get(cat.name) || []).slice(0, 8);
        return (
          <section key={cat.id}>
            <div className="v19-section-title">
              <h3>{cat.name}</h3>
              <Link to={storefrontPath(slug, `category/${cat.slug}`)}>see all <ChevronRight className="h-3 w-3" /></Link>
            </div>
            <div className="flex gap-2.5 overflow-x-auto scrollbar-hide pb-1 -mx-3 px-3">
              {items.map((p, i) => (
                <div key={p.id} className="flex-shrink-0" style={{ width: "42%" }}>
                  <V19ProductCard product={p} slug={slug} store={store} priority={i < 2} />
                </div>
              ))}
            </div>
          </section>
        );
      })}

      {visibleCategories.length === 0 && products.length > 0 && (
        <section>
          <div className="v19-section-title">
            <h3>All Products</h3>
            <Link to={storefrontPath(slug, "shop")}>see all <ChevronRight className="h-3 w-3" /></Link>
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
