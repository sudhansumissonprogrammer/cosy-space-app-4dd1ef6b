/**
 * Theme 17 Home — Streetwear-inspired layout:
 * 1. Full-screen Hero Banner with CTA
 * 2. "All Collection" product grid (2-col mobile, 4-col desktop)
 * 3. Scrolling trust ticker
 * 4. Customer Reviews carousel
 * 5. Trust badges row
 */
import { lazy, Suspense } from "react";
import { useOutletContext, useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useStorefrontThemeConfig } from "@/hooks/useStorefrontThemeConfig";
import { useStorefrontProducts } from "@/hooks/useStorefrontProducts";
import { useBestSellingProducts } from "@/hooks/useBestSellingProducts";
import { supabase } from "@/integrations/supabase/client";
import { Star, Truck, Gem, ShieldCheck, ArrowRight } from "lucide-react";
import SectionHeading from "@/components/storefront/SectionHeading";
import { VariantCountProvider } from "@/hooks/useVariantCounts";
import type { StoreData } from "@/layouts/StorefrontLayout";
import UniversalProductCard from "@/components/storefront/UniversalProductCard";
import StorefrontMobileHero from "@/components/storefront/StorefrontMobileHero";
import HeroBannerCarousel from "@/components/storefront/HeroBannerCarousel";
import LazyRender from "@/components/storefront/LazyRender";
import { useStoreJsonLd } from "@/hooks/useJsonLd";
import { storefrontPath } from "@/lib/subdomain";
import ProductCardSkeleton from "@/components/storefront/ProductCardSkeleton";

const BestSellingCarousel = lazy(() => import("@/components/storefront/BestSellingCarousel"));
const StorefrontInstagramSection = lazy(() => import("@/components/storefront/StorefrontInstagramSection"));

const ABOVE_FOLD_COUNT = 6;

/* ─── Scrolling trust ticker ─── */
function TrustTicker() {
  const items = [
    "✦ Premium Fabric",
    "✦ Exclusive Seasonal Picks",
    "✦ Limited Quantity",
    "✦ Premium Fabric",
    "✦ Exclusive Seasonal Picks",
    "✦ Limited Quantity",
  ];

  return (
    <div className="overflow-hidden py-5" style={{ backgroundColor: "var(--storefront-primary, #1B3A2D)" }}>
      <div className="flex whitespace-nowrap animate-[marquee_20s_linear_infinite]">
        {[...items, ...items].map((text, i) => (
          <span key={i} className="mx-8 text-lg font-medium tracking-wide" style={{ color: "var(--storefront-btn-text, #fff)" }}>
            {text}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ─── Customer review card ─── */
function ReviewCard({ name, text, rating, product, verified }: {
  name: string; text: string; rating: number; product: string; verified?: boolean;
}) {
  return (
    <div className="min-w-[300px] max-w-[340px] flex-shrink-0 rounded-xl border bg-card p-5 space-y-3 snap-start">
      <div className="flex items-center gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} className={`h-4 w-4 ${i < rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`} />
        ))}
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground line-clamp-4">{text}</p>
      <div className="flex items-center gap-2 pt-1">
        <div
          className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold"
          style={{ backgroundColor: "var(--storefront-primary, #1B3A2D)", color: "var(--storefront-btn-text, #fff)" }}
        >
          {name.charAt(0)}
        </div>
        <div>
          <p className="text-sm font-semibold">{name}</p>
          {verified && <p className="text-xs text-emerald-600">✓ Verified Buyer</p>}
        </div>
      </div>
      {product && <p className="text-xs text-muted-foreground border-t pt-2">Reviewed: {product}</p>}
    </div>
  );
}

/* ─── Reviews section ─── */
function ReviewsSection({ storeId }: { storeId: string }) {
  const { data: reviews } = useQuery({
    queryKey: ["storefront-reviews-v17", storeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("product_reviews")
        .select("*, products(name)")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(10);
      return data || [];
    },
    staleTime: 5 * 60_000,
  });

  const defaultReviews = [
    { customer_name: "Arjun K.", review_text: "Amazing quality hoodie! The fabric is so soft and the fit is perfect. Will definitely order again.", rating: 5, is_verified: true, products: { name: "Premium Hoodie" } },
    { customer_name: "Priya S.", review_text: "Loved the oversized fit. Exactly as shown in pictures. Very premium feel compared to other brands.", rating: 5, is_verified: true, products: { name: "Oversized Tee" } },
    { customer_name: "Rahul M.", review_text: "Fast delivery and excellent packaging. The design is unique and I get compliments everywhere I go.", rating: 4, is_verified: true, products: { name: "Graphic Hoodie" } },
  ];

  const displayReviews = reviews && reviews.length > 0 ? reviews : defaultReviews;

  return (
    <section className="py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-2">Customer Say!</h2>
        <p className="text-center text-muted-foreground mb-8">
          Customers love our products and we always strive to please them all.
        </p>
        <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide">
          {displayReviews.map((r: any, i: number) => (
            <ReviewCard
              key={i}
              name={r.customer_name}
              text={r.review_text || "Great product!"}
              rating={r.rating}
              product={(r.products as any)?.name || ""}
              verified={r.is_verified}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Trust badges ─── */
function TrustBadges() {
  const badges = [
    { icon: Truck, label: "Free Shipping", desc: "On orders above ₹999" },
    { icon: Gem, label: "Exclusive Designs", desc: "Limited edition drops" },
    { icon: ShieldCheck, label: "Premium Quality", desc: "Handpicked fabrics" },
  ];
  return (
    <section className="py-10 px-4 border-t">
      <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
        {badges.map((b, i) => (
          <div key={i} className="flex flex-col items-center gap-2">
            <b.icon className="h-8 w-8" style={{ color: "var(--storefront-primary, #1B3A2D)" }} />
            <p className="font-semibold text-sm">{b.label}</p>
            <p className="text-xs text-muted-foreground">{b.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─── Main Home Component ─── */
export default function StorefrontHomeV17() {
  const params = useParams<{ slug: string }>();
  const ctx = useOutletContext<{ store: StoreData; slug: string }>();
  const store = ctx?.store;
  const slug = ctx?.slug || params.slug || "";

  const themeConfig = useStorefrontThemeConfig(store?.id);
  const cardStyle = themeConfig?.product_card_style || "style-1";

  // Products
  const { products, isLoading: productsLoading } = useStorefrontProducts(store?.id);
  const bsQuery = useBestSellingProducts(store?.id);
  const bestSellers = bsQuery.products;
  const showBestSellers = store?.best_selling_carousel && bestSellers.length > 0;

  // JSON-LD
  useStoreJsonLd({
    storeName: store?.name || "",
    storeSlug: slug,
    description: store?.description || undefined,
    logo: store?.logo_url || undefined,
    location: store?.location || undefined,
    whatsappNumber: store?.whatsapp_number || undefined,
    customDomain: (store as any)?.custom_domain || undefined,
    instagramUrl: store?.instagram_url || undefined,
    facebookUrl: store?.facebook_url || undefined,
    city: store?.city || undefined,
    state: store?.state || undefined,
    businessHours: store?.business_hours || undefined,
  });

  if (!store) return null;

  const aboveFold = products.slice(0, ABOVE_FOLD_COUNT);
  const belowFold = products.slice(ABOVE_FOLD_COUNT);
  const allProductIds = products.map((p: any) => p.id);

  const hasBanner = !!(store as any).banner_url;
  const hasMobileHero = !!(store as any).mobile_hero_url || !!(store as any).mobile_hero_images;

  return (
    <VariantCountProvider productIds={allProductIds}>
      {/* ─── Hero Banner ─── */}
      <section className="relative">
        {hasBanner && (
          <div className="hidden md:block">
            <HeroBannerCarousel
              images={[(store as any).banner_url]}
              storeName={store.name}
              imageClassName="w-full h-auto object-cover"
              maxHeight="600px"
            />
          </div>
        )}
        {hasMobileHero && (
          <div className="md:hidden">
            <StorefrontMobileHero
              mobileHeroUrl={(store as any).mobile_hero_url}
              mobileHeroImages={(store as any).mobile_hero_images}
              storeName={store.name}
            />
          </div>
        )}
        {/* CTA overlay */}
        {(hasBanner || hasMobileHero) && (
          <div className="absolute inset-0 flex items-end justify-center pb-12 md:pb-16 pointer-events-none">
            <Link
              to={storefrontPath(slug, "/shop")}
              className="pointer-events-auto px-8 py-3 text-sm font-semibold tracking-wider uppercase rounded shadow-lg transition-transform hover:scale-105"
              style={{
                backgroundColor: "var(--storefront-primary, #1B3A2D)",
                color: "var(--storefront-btn-text, #fff)",
              }}
            >
              Shop Collection
            </Link>
          </div>
        )}
      </section>

      {/* ─── All Collection ─── */}
      <section className="py-10 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-2">All Collection</h2>
          <p className="text-center text-muted-foreground mb-8">
            Unmatched design and superior comfort. <strong>Limited drop. No restocks.</strong>
          </p>

          {productsLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Array.from({ length: ABOVE_FOLD_COUNT }).map((_, i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {aboveFold.map((p: any, i: number) => (
                  <UniversalProductCard key={p.id} product={p} slug={slug} store={store} priority={i < 2} cardStyle={cardStyle} index={i} />
                ))}
              </div>
              {belowFold.length > 0 && (
                <LazyRender rootMargin="200px">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                    {belowFold.map((p: any, i: number) => (
                      <UniversalProductCard key={p.id} product={p} slug={slug} store={store} cardStyle={cardStyle} index={i + ABOVE_FOLD_COUNT} />
                    ))}
                  </div>
                </LazyRender>
              )}
            </>
          )}

          {products.length > 0 && (
            <div className="text-center mt-8">
              <Link
                to={storefrontPath(slug, "/shop")}
                className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold rounded border-2 transition-colors hover:opacity-90"
                style={{
                  borderColor: "var(--storefront-primary, #1B3A2D)",
                  color: "var(--storefront-primary, #1B3A2D)",
                }}
              >
                View All Products <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ─── Best Sellers ─── */}
      {showBestSellers && (
        <LazyRender rootMargin="200px">
          <section className="py-8 px-4">
            <div className="max-w-6xl mx-auto">
              <SectionHeading title="Best Sellers" />
              <Suspense fallback={null}>
                <BestSellingCarousel products={bestSellers} slug={slug} store={store} cardStyle={cardStyle} />
              </Suspense>
            </div>
          </section>
        </LazyRender>
      )}

      {/* ─── Trust Ticker ─── */}
      <LazyRender rootMargin="100px">
        <TrustTicker />
      </LazyRender>

      {/* ─── Customer Reviews ─── */}
      <LazyRender rootMargin="200px">
        <ReviewsSection storeId={store.id} />
      </LazyRender>

      {/* ─── Trust Badges ─── */}
      <LazyRender rootMargin="100px">
        <TrustBadges />
      </LazyRender>

      {/* ─── Instagram ─── */}
      {store.instagram_url && (
        <LazyRender rootMargin="200px">
          <Suspense fallback={null}>
            <StorefrontInstagramSection store={store} />
          </Suspense>
        </LazyRender>
      )}
    </VariantCountProvider>
  );
}
