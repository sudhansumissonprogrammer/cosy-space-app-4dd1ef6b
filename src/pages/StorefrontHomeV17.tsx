/**
 * Theme 17 Home — systumm.shop-inspired layout:
 * 1. Full-screen Hero Banner
 * 2. "All Collection" product grid (2-col mobile, 4-col desktop) with V17 card
 * 3. Scrolling trust ticker
 * 4. Customer Reviews carousel
 * 5. Trust badges row
 */
import { lazy, Suspense } from "react";
import { useOutletContext, useParams, Link } from "react-router-dom";
import { useStorefrontThemeConfig } from "@/hooks/useStorefrontThemeConfig";
import { useStorefrontProducts } from "@/hooks/useStorefrontProducts";
import { useBestSellingProducts } from "@/hooks/useBestSellingProducts";
import { ArrowRight } from "lucide-react";
import SectionHeading from "@/components/storefront/SectionHeading";
import { VariantCountProvider } from "@/hooks/useVariantCounts";
import type { StoreData } from "@/layouts/StorefrontLayout";
import StorefrontMobileHero from "@/components/storefront/StorefrontMobileHero";
import HeroBannerCarousel from "@/components/storefront/HeroBannerCarousel";
import LazyRender from "@/components/storefront/LazyRender";
import { useStoreJsonLd } from "@/hooks/useJsonLd";
import { storefrontPath } from "@/lib/subdomain";
import ProductCardSkeleton from "@/components/storefront/ProductCardSkeleton";
import ProductCardV17 from "@/components/storefront/ProductCardV17";
import VariantPickerDialog from "@/components/storefront/VariantPickerDialog";
import { useVariantCount } from "@/hooks/useVariantCounts";
import { prefetchProductDetail } from "@/lib/prefetchProductDetail";
import ReviewsSection from "@/components/storefront/v17/ReviewsSection";
import TrustTicker from "@/components/storefront/v17/TrustTicker";
import TrustBadges from "@/components/storefront/v17/TrustBadges";

const BestSellingCarousel = lazy(() => import("@/components/storefront/BestSellingCarousel"));
const StorefrontInstagramSection = lazy(() => import("@/components/storefront/StorefrontInstagramSection"));

const ABOVE_FOLD_COUNT = 6;

/* ─── V17 Product Card wrapper with variant support ─── */
function V17CardWrapper({ product, slug, store, priority, index }: { product: any; slug: string; store: any; priority?: boolean; index: number }) {
  const variantCount = useVariantCount(product.id);
  const hasVariants = variantCount > 0;
  const [variantOpen, setVariantOpen] = React.useState(false);

  return (
    <div
      className="stagger-card"
      style={{ "--i": index } as React.CSSProperties}
      onMouseEnter={prefetchProductDetail}
      onTouchStart={prefetchProductDetail}
    >
      <ProductCardV17
        product={product}
        slug={slug}
        store={store}
        priority={priority}
        onVariantRequired={hasVariants ? () => setVariantOpen(true) : undefined}
      />
      {hasVariants && (
        <VariantPickerDialog
          open={variantOpen}
          onClose={() => setVariantOpen(false)}
          product={product}
        />
      )}
    </div>
  );
}

import React from "react";

/* ─── Main Home Component ─── */
export default function StorefrontHomeV17() {
  const params = useParams<{ slug: string }>();
  const store = useOutletContext<StoreData>();
  const slug = params.slug || (store as any)?.slug || "";

  const _themeConfig = useStorefrontThemeConfig(store?.id);

  const { products, isLoading: productsLoading } = useStorefrontProducts(store?.id);
  const bsQuery = useBestSellingProducts(store?.id);
  const bestSellers = bsQuery.products;
  const showBestSellers = store?.best_selling_carousel && bestSellers.length > 0;

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
      </section>

      {/* ─── All Collection ─── */}
      <section className="py-10 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-1">All Collection</h2>
          <p className="text-center text-sm text-gray-500 mb-8">
            Unmatched design and superior comfort
          </p>

          {productsLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5">
              {Array.from({ length: ABOVE_FOLD_COUNT }).map((_, i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5">
                {aboveFold.map((p: any, i: number) => (
                  <V17CardWrapper key={p.id} product={p} slug={slug} store={store} priority={i < 2} index={i} />
                ))}
              </div>
              {belowFold.length > 0 && (
                <LazyRender rootMargin="200px">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5 mt-4">
                    {belowFold.map((p: any, i: number) => (
                      <V17CardWrapper key={p.id} product={p} slug={slug} store={store} index={i + ABOVE_FOLD_COUNT} />
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
                <BestSellingCarousel products={bestSellers} slug={slug} store={store} cardStyle="style-1" />
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
