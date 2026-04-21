/**
 * StorefrontHomeV19 — Blinkit-style home, fully responsive.
 * Mobile: swipeable promos, 4-col category circles, horizontal product strips.
 * Desktop: multi-promo carousel with auto-rotate + arrows, 8-10 col categories, dense product grids with arrow nav.
 */
import { useEffect, useMemo, useRef } from "react";
import { useOutletContext, useParams, Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useStorefrontProducts } from "@/hooks/useStorefrontProducts";
import { ChevronRight, ChevronLeft, Tag } from "lucide-react";
import type { StoreData } from "@/layouts/StorefrontLayout";
import V19ProductCard from "@/components/storefront/v19/V19ProductCard";
import { storefrontPath } from "@/lib/subdomain";
import { optimizeImageUrl } from "@/lib/imageOptimize";
import { useRecentlyViewed } from "@/hooks/useRecentlyViewed";

interface Category { id: string; name: string; slug: string; image_url: string | null; show_on_home?: boolean; }

const PASTELS = ["#FFF1D6", "#FFE5E5", "#DDEBFF", "#E5F7E5", "#FFE7F3", "#F0E5FF", "#FFF7CC", "#D6F5F0", "#FFE9D6", "#E0F0FF"];

const PROMO_CARDS = [
  { bg: "linear-gradient(135deg, #FFD33D 0%, #FFC107 100%)", title: "Fresh deals", subtitle: "in minutes" },
  { bg: "linear-gradient(135deg, #FFB7C5 0%, #FF8FA3 100%)", title: "Snack attack", subtitle: "30% off today" },
  { bg: "linear-gradient(135deg, #B8E6C1 0%, #7DD3A0 100%)", title: "Daily essentials", subtitle: "starting ₹19" },
  { bg: "linear-gradient(135deg, #C5DDFF 0%, #8FB5FF 100%)", title: "New arrivals", subtitle: "fresh stock daily" },
  { bg: "linear-gradient(135deg, #FFE7B5 0%, #FFC36A 100%)", title: "Weekend savings", subtitle: "up to 40% off" },
];

function HorizontalScroller({ children, ariaLabel }: { children: React.ReactNode; ariaLabel?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const scrollBy = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  };
  return (
    <div className="v19-carousel-wrap relative">
      <div
        ref={ref}
        className="flex gap-2.5 lg:gap-3 overflow-x-auto scrollbar-hide pb-1 -mx-3 px-3 md:mx-0 md:px-0 snap-x"
        aria-label={ariaLabel}
      >
        {children}
      </div>
      <button
        type="button"
        aria-label="Scroll left"
        onClick={() => scrollBy(-1)}
        className="v19-carousel-arrow left"
      >
        <ChevronLeft className="h-5 w-5" strokeWidth={2.5} />
      </button>
      <button
        type="button"
        aria-label="Scroll right"
        onClick={() => scrollBy(1)}
        className="v19-carousel-arrow right"
      >
        <ChevronRight className="h-5 w-5" strokeWidth={2.5} />
      </button>
    </div>
  );
}

function PromoCarousel({ slug }: { slug: string }) {
  const ref = useRef<HTMLDivElement>(null);
  // Auto-rotate every 5s — only on desktop (where multiple promos visible).
  // Scroll exactly one card width (matches snap points → no janky mid-card stops).
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(min-width: 1024px)").matches) return;
    const id = setInterval(() => {
      const el = ref.current;
      if (!el) return;
      const card = el.querySelector<HTMLElement>(".v19-promo-card");
      const step = card ? card.offsetWidth + 12 /* gap */ : el.clientWidth * 0.25;
      const max = el.scrollWidth - el.clientWidth;
      const next = el.scrollLeft + step;
      el.scrollTo({ left: next > max - 8 ? 0 : next, behavior: "smooth" });
    }, 5000);
    return () => clearInterval(id);
  }, []);

  const scrollBy = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>(".v19-promo-card");
    const step = card ? card.offsetWidth + 12 : el.clientWidth * 0.5;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  };

  return (
    <div className="v19-carousel-wrap relative">
      <div
        ref={ref}
        className="overflow-x-auto scrollbar-hide -mx-1 snap-x snap-mandatory"
      >
        <div className="flex gap-3 px-1">
          {PROMO_CARDS.map((promo, i) => (
            <div
              key={i}
              className="v19-promo-card"
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
      <button type="button" aria-label="Previous" onClick={() => scrollBy(-1)} className="v19-carousel-arrow left">
        <ChevronLeft className="h-5 w-5" strokeWidth={2.5} />
      </button>
      <button type="button" aria-label="Next" onClick={() => scrollBy(1)} className="v19-carousel-arrow right">
        <ChevronRight className="h-5 w-5" strokeWidth={2.5} />
      </button>
    </div>
  );
}

export default function StorefrontHomeV19() {
  const params = useParams<{ slug: string }>();
  const store = useOutletContext<StoreData>();
  const slug = params.slug || (store as any)?.slug || "";
  const queryClient = useQueryClient();
  const categories = (queryClient.getQueryData<Category[]>(["storefront-categories", store?.id]) || []) as Category[];
  const { products } = useStorefrontProducts(store?.id);
  const { items: recent } = useRecentlyViewed(store?.id);

  const productsByCategory = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const p of products) {
      const cat = (p as any).category || "Other";
      if (!m.has(cat)) m.set(cat, []);
      m.get(cat)!.push(p);
    }
    return m;
  }, [products]);

  if (!store) return null;

  // Only categories the merchant chose to show on home (default true) AND have products
  const homeEligible = categories.filter((c) => c.show_on_home !== false);
  const visibleCategories = homeEligible.filter((c) => productsByCategory.has(c.name));

  // Recent items that still exist in current product list
  const productIds = new Set(products.map((p) => p.id));
  const recentVisible = recent.filter((r) => productIds.has(r.id));

  return (
    <div className="space-y-5 md:space-y-7 pb-4">
      {/* Hero banner with aspect-ratio reservation to prevent CLS */}
      {(store as any).banner_url && (
        <Link to={storefrontPath(slug, "shop")} className="block rounded-2xl overflow-hidden shadow-sm">
          <div className="w-full" style={{ aspectRatio: "16 / 6" }}>
            <img
              src={optimizeImageUrl((store as any).banner_url, 1400, 85)}
              alt={store.name}
              className="w-full h-full object-cover block"
              loading="eager"
              fetchPriority="high"
              width={1400}
              height={525}
            />
          </div>
        </Link>
      )}

      {/* Promo carousel */}
      <PromoCarousel slug={slug} />

      {/* Categories — single large tile grid showing ALL categories */}
      {categories.length > 0 && (
        <section>
          <div className="v19-section-title">
            <h3>Categories</h3>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5 lg:gap-3">
            {categories.map((cat, i) => (
              <Link
                key={cat.id}
                to={storefrontPath(slug, `category/${cat.slug}`)}
                className="group flex flex-col items-center"
              >
                <div
                  className="relative w-full overflow-hidden rounded-xl transition-transform group-active:scale-95"
                  style={{ aspectRatio: "1 / 1", background: PASTELS[i % PASTELS.length] }}
                >
                  {cat.image_url ? (
                    <img
                      src={optimizeImageUrl(cat.image_url, 300, 85)}
                      alt={cat.name}
                      className="absolute inset-0 w-full h-full object-contain p-2"
                      loading="lazy"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Tag className="h-8 w-8 text-gray-700" />
                    </div>
                  )}
                </div>
                <span className="mt-1.5 text-[12px] sm:text-[13px] font-medium text-center text-gray-800 line-clamp-2 leading-tight">
                  {cat.name}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
              <Link
                key={cat.id}
                to={storefrontPath(slug, `category/${cat.slug}`)}
                className="group flex flex-col items-center"
              >
                <div
                  className="relative w-full overflow-hidden rounded-xl transition-transform group-active:scale-95"
                  style={{ aspectRatio: "1 / 1", background: PASTELS[i % PASTELS.length] }}
                >
                  {cat.image_url ? (
                    <img
                      src={optimizeImageUrl(cat.image_url, 300, 85)}
                      alt={cat.name}
                      className="absolute inset-0 w-full h-full object-contain p-2"
                      loading="lazy"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Tag className="h-8 w-8 text-gray-700" />
                    </div>
                  )}
                </div>
                <span className="mt-1.5 text-[12px] sm:text-[13px] font-medium text-center text-gray-800 line-clamp-2 leading-tight">
                  {cat.name}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
