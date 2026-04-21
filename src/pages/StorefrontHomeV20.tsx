/**
 * StorefrontHomeV20 — Theme 20 (Multi Purpose). Duplicated from StorefrontHomeV19.
 */
import { useEffect, useMemo, useRef } from "react";
import { useOutletContext, useParams, Link } from "react-router-dom";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useStorefrontProducts } from "@/hooks/useStorefrontProducts";
import { ChevronRight, ChevronLeft, Tag } from "lucide-react";
import type { StoreData } from "@/layouts/StorefrontLayout";
import V20ProductCard from "@/components/storefront/v20/V20ProductCard";
import { storefrontPath } from "@/lib/subdomain";
import { optimizeImageUrl } from "@/lib/imageOptimize";
import MobileHeroCarousel from "@/components/storefront/MobileHeroCarousel";
import { useRecentlyViewed } from "@/hooks/useRecentlyViewed";
import { supabase } from "@/integrations/supabase/client";

interface Category { id: string; name: string; slug: string; image_url: string | null; show_on_home?: boolean; }

const PROMO_CARDS = [
  { bg: "linear-gradient(135deg, #FFD33D 0%, #FFC107 100%)", title: "Fresh deals", subtitle: "in minutes", darkText: true },
  { bg: "linear-gradient(135deg, #FFB7C5 0%, #FF8FA3 100%)", title: "Snack attack", subtitle: "30% off today", darkText: true },
  { bg: "linear-gradient(135deg, var(--storefront-primary, #036B52) 0%, var(--storefront-primary-light, #4ea892) 100%)", title: "Daily essentials", subtitle: "starting ₹19", darkText: false },
  { bg: "linear-gradient(135deg, #C5DDFF 0%, #8FB5FF 100%)", title: "New arrivals", subtitle: "fresh stock daily", darkText: true },
  { bg: "linear-gradient(135deg, #FFE7B5 0%, #FFC36A 100%)", title: "Weekend savings", subtitle: "up to 40% off", darkText: true },
];

function HorizontalScroller({ children, ariaLabel }: { children: React.ReactNode; ariaLabel?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const scrollBy = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  };
  return (
    <div className="v20-carousel-wrap relative">
      <div
        ref={ref}
        className="flex gap-2.5 lg:gap-3 overflow-x-auto scrollbar-hide pb-1 -mx-3 px-3 md:mx-0 md:px-0 snap-x"
        aria-label={ariaLabel}
      >
        {children}
      </div>
      <button type="button" aria-label="Scroll left" onClick={() => scrollBy(-1)} className="v20-carousel-arrow left">
        <ChevronLeft className="h-5 w-5" strokeWidth={2.5} />
      </button>
      <button type="button" aria-label="Scroll right" onClick={() => scrollBy(1)} className="v20-carousel-arrow right">
        <ChevronRight className="h-5 w-5" strokeWidth={2.5} />
      </button>
    </div>
  );
}

function PromoCarousel({ slug }: { slug: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(min-width: 1024px)").matches) return;
    const id = setInterval(() => {
      const el = ref.current;
      if (!el) return;
      const card = el.querySelector<HTMLElement>(".v20-promo-card");
      const step = card ? card.offsetWidth + 12 : el.clientWidth * 0.25;
      const max = el.scrollWidth - el.clientWidth;
      const next = el.scrollLeft + step;
      el.scrollTo({ left: next > max - 8 ? 0 : next, behavior: "smooth" });
    }, 5000);
    return () => clearInterval(id);
  }, []);

  const scrollBy = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>(".v20-promo-card");
    const step = card ? card.offsetWidth + 12 : el.clientWidth * 0.5;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  };

  return (
    <div className="v20-carousel-wrap relative">
      <div ref={ref} className="overflow-x-auto scrollbar-hide -mx-1 snap-x snap-mandatory">
        <div className="flex gap-3 px-1">
          {PROMO_CARDS.map((promo, i) => {
            const headingColor = promo.darkText ? "#0a0a0a" : "#ffffff";
            const bodyColor = promo.darkText ? "rgba(10,10,10,0.85)" : "rgba(255,255,255,0.88)";

            return (
              <div key={i} className="v20-promo-card" style={{ background: promo.bg }}>
                <div>
                  <h2 style={{ color: headingColor }}>{promo.title}</h2>
                  <h2 style={{ marginTop: 0, color: headingColor }}>{promo.subtitle}</h2>
                  <p style={{ color: bodyColor }}>Tap to explore</p>
                </div>
                <Link
                  to={storefrontPath(slug, "shop")}
                  className="cta"
                  style={promo.darkText ? undefined : { background: "#ffffff", color: "var(--storefront-primary, #036B52)" }}
                >
                  Shop Now
                </Link>
              </div>
            );
          })}
        </div>
      </div>
      <button type="button" aria-label="Previous" onClick={() => scrollBy(-1)} className="v20-carousel-arrow left">
        <ChevronLeft className="h-5 w-5" strokeWidth={2.5} />
      </button>
      <button type="button" aria-label="Next" onClick={() => scrollBy(1)} className="v20-carousel-arrow right">
        <ChevronRight className="h-5 w-5" strokeWidth={2.5} />
      </button>
    </div>
  );
}

export default function StorefrontHomeV20() {
  const params = useParams<{ slug: string }>();
  const store = useOutletContext<StoreData>();
  const slug = params.slug || (store as any)?.slug || "";
  const queryClient = useQueryClient();
  const normalizeCategory = (value?: string | null) =>
    (value || "")
      .trim()
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const getEditDistance = (a: string, b: string) => {
    const rows = a.length + 1;
    const cols = b.length + 1;
    const dp = Array.from({ length: rows }, () => Array<number>(cols).fill(0));

    for (let i = 0; i < rows; i++) dp[i][0] = i;
    for (let j = 0; j < cols; j++) dp[0][j] = j;

    for (let i = 1; i < rows; i++) {
      for (let j = 1; j < cols; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + cost,
        );
      }
    }

    return dp[a.length][b.length];
  };

  const { data: allCategories = [] } = useQuery({
    queryKey: ["storefront-categories-all", store?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("categories")
        .select("id, name, slug, image_url, show_on_home")
        .eq("store_id", store!.id)
        .order("display_order", { ascending: true });
      return (data || []) as Category[];
    },
    enabled: !!store?.id,
    staleTime: 5 * 60 * 1000,
  });

  const categories = allCategories;
  const { products } = useStorefrontProducts(store?.id);
  const { items: recent } = useRecentlyViewed(store?.id);

  const { data: allProducts = [] } = useQuery({
    queryKey: ["storefront-products-all-v20", store?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id,category,currency,description,image_url,is_active,is_best_selling,name,price,sale_price,slug,stock_quantity,store_id")
        .eq("store_id", store!.id)
        .eq("is_active", true)
        .order("is_best_selling", { ascending: false })
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!store?.id,
    staleTime: 5 * 60 * 1000,
  });

  const productsByCategory = useMemo(() => {
    const map = new Map<string, any[]>();
    const source = allProducts.length > 0 ? allProducts : products;

    for (const product of source) {
      const key = normalizeCategory((product as any).category);
      if (!key) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(product);
    }

    return map;
  }, [allProducts, products]);

  const getCategoryItems = (category: Category) => {
    const normalizedName = normalizeCategory(category.name);
    const normalizedSlug = normalizeCategory(category.slug);

    const byName = productsByCategory.get(normalizedName);
    if (byName?.length) return byName;

    const bySlug = productsByCategory.get(normalizedSlug);
    if (bySlug?.length) return bySlug;

    const fallbackEntry = Array.from(productsByCategory.entries()).find(([key]) => {
      if (!key) return false;
      if (normalizedName && (key.includes(normalizedName) || normalizedName.includes(key))) return true;
      if (normalizedSlug && (key.includes(normalizedSlug) || normalizedSlug.includes(key))) return true;

      const nameDistance = normalizedName ? getEditDistance(key, normalizedName) : Infinity;
      const slugDistance = normalizedSlug ? getEditDistance(key, normalizedSlug) : Infinity;
      return Math.min(nameDistance, slugDistance) <= 2;
    });

    return fallbackEntry?.[1] || [];
  };

  if (!store) return null;

  const isLoadingProducts = allProducts.length === 0 && products.length === 0;
  if (isLoadingProducts && categories.length === 0) {
    return (
      <div className="space-y-5 pb-4 animate-pulse">
        <div className="rounded-2xl bg-gray-200 w-full" style={{ aspectRatio: "16 / 6" }} />
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-gray-200 flex-shrink-0 w-[78%] sm:w-[45%] md:w-[24%] h-[130px]" />
          ))}
        </div>
        <div>
          <div className="h-5 w-32 bg-gray-200 rounded mb-3" />
          <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="rounded-xl bg-gray-200" style={{ aspectRatio: "1 / 1" }} />
                <div className="h-3 bg-gray-200 rounded w-3/4 mx-auto" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const homeEligibleCategories = categories.filter((category) => category.show_on_home !== false);
  const visibleCategories = homeEligibleCategories.filter((category) => getCategoryItems(category).length > 0);

  const productIds = new Set(products.map((p) => p.id));
  const recentVisible = recent.filter((r) => productIds.has(r.id));

  return (
    <div className="space-y-5 md:space-y-7 pb-4">
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

      {(() => {
        const heroImagesRaw = (store as any).mobile_hero_images;
        const heroList: string[] = Array.isArray(heroImagesRaw)
          ? heroImagesRaw.filter((u: any) => typeof u === "string" && u.trim().length > 0)
          : [];
        const singleHero = (store as any).mobile_hero_url as string | undefined;
        const merged: string[] = [];
        if (singleHero && singleHero.trim()) merged.push(singleHero);
        for (const u of heroList) if (!merged.includes(u)) merged.push(u);
        const heroes = merged;
        if (heroes.length === 0) return <PromoCarousel slug={slug} />;
        return (
          <MobileHeroCarousel
            images={heroes}
            storeName={store.name}
            linkTo={storefrontPath(slug, "shop")}
          />
        );
      })()}

      <div className="hidden md:block">
        <PromoCarousel slug={slug} />
      </div>

      {homeEligibleCategories.length > 0 && (
        <section>
          <div className="v20-section-title">
            <h3>Categories</h3>
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5 lg:gap-3">
            {homeEligibleCategories.map((cat) => (
              <Link
                key={cat.id}
                to={storefrontPath(slug, `category/${cat.slug}`)}
                className="group flex flex-col items-center"
              >
                <div
                  className="relative w-full overflow-hidden rounded-xl transition-transform group-active:scale-95 bg-muted"
                  style={{ aspectRatio: "1 / 1" }}
                >
                  {cat.image_url ? (
                    <img
                      src={optimizeImageUrl(cat.image_url, 300, 85)}
                      alt={cat.name}
                      className="absolute inset-0 w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Tag className="h-8 w-8 text-muted-foreground" />
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

      {visibleCategories.map((cat) => {
        const items = getCategoryItems(cat).slice(0, 12);
        return (
          <section key={cat.id}>
            <div className="v20-section-title">
              <h3>{cat.name}</h3>
              <Link to={storefrontPath(slug, `category/${cat.slug}`)}>see all <ChevronRight className="h-3 w-3" /></Link>
            </div>
            <HorizontalScroller ariaLabel={cat.name}>
              {items.map((p, i) => (
                <div
                  key={p.id}
                  className="flex-shrink-0 snap-start w-[44%] sm:w-[30%] md:w-[24%] lg:w-[19%] xl:w-[16%]"
                >
                  <V20ProductCard product={p} slug={slug} store={store} priority={i < 2} />
                </div>
              ))}
            </HorizontalScroller>
          </section>
        );
      })}
    </div>
  );
}
