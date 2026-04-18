/**
 * Theme 17 Home — systumm.shop-exact layout:
 * 1. Full-screen Hero Banner
 * 2. Categories horizontal scroll
 * 3. Best Sellers (carousel if enabled, grid otherwise) — appears first
 * 4. "All Collection" product grid (2-col mobile, 4-col desktop) with V17 card
 * 5. Scrolling trust ticker
 * 6. Customer Reviews carousel
 * 7. Trust badges row
 */
import { lazy, Suspense, useState } from "react";
import { useOutletContext, useParams, Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useStorefrontThemeConfig } from "@/hooks/useStorefrontThemeConfig";
import { useStorefrontProducts } from "@/hooks/useStorefrontProducts";
import { useBestSellingProducts } from "@/hooks/useBestSellingProducts";
import { ArrowRight } from "lucide-react";
import { VariantCountProvider, useVariantCount } from "@/hooks/useVariantCounts";
import type { StoreData } from "@/layouts/StorefrontLayout";
import StorefrontMobileHero from "@/components/storefront/StorefrontMobileHero";
import HeroBannerCarousel from "@/components/storefront/HeroBannerCarousel";
import LazyRender from "@/components/storefront/LazyRender";
import { useStoreJsonLd } from "@/hooks/useJsonLd";
import { storefrontPath } from "@/lib/subdomain";
import ProductCardSkeleton from "@/components/storefront/ProductCardSkeleton";
import ProductCardV17 from "@/components/storefront/ProductCardV17";
import VariantPickerDialog from "@/components/storefront/VariantPickerDialog";
import UniversalCategories from "@/components/storefront/UniversalCategories";
import { prefetchProductDetail } from "@/lib/prefetchProductDetail";
import ReviewsSection from "@/components/storefront/v17/ReviewsSection";
import TrustTicker from "@/components/storefront/v17/TrustTicker";
import TrustBadges from "@/components/storefront/v17/TrustBadges";
import { optimizeImageUrl } from "@/lib/imageOptimize";

const BestSellingCarousel = lazy(() => import("@/components/storefront/BestSellingCarousel"));
const StorefrontInstagramSection = lazy(() => import("@/components/storefront/StorefrontInstagramSection"));

const ABOVE_FOLD_COUNT = 8;

/* ─── V17 Product Card wrapper with variant support ─── */
function V17CardWrapper({ product, slug, store, priority, index }: { product: any; slug: string; store: any; priority?: boolean; index: number }) {
  const variantCount = useVariantCount(product.id);
  const hasVariants = variantCount > 0;
  const [variantOpen, setVariantOpen] = useState(false);

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

/* ─── V17 Categories Section ─── */
function V17Categories({ categories, slug }: { categories: any[]; slug: string }) {
  if (!categories || categories.length === 0) return null;

  return (
    <section style={{ padding: "30px 15px 10px" }}>
      <div className="max-w-7xl mx-auto">
        <h2
          className="text-center"
          style={{
            fontFamily: "var(--v17-heading-font)",
            fontSize: "clamp(20px, 3.5vw, 28px)",
            fontWeight: 500,
            letterSpacing: "0.02em",
            color: "var(--v17-text, #000)",
            marginBottom: "20px",
            textTransform: "capitalize",
          }}
        >
          Shop by Category
        </h2>
        <div
          className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none", WebkitOverflowScrolling: "touch" }}
        >
          {categories.map((cat) => (
            <Link
              key={cat.id}
              to={storefrontPath(slug, `category/${cat.slug}`)}
              className="flex flex-col items-center gap-2 flex-shrink-0 transition-transform hover:scale-105"
              style={{ minWidth: "80px" }}
            >
              <div
                className="overflow-hidden"
                style={{
                  width: "72px",
                  height: "72px",
                  borderRadius: "50%",
                  border: "2px solid var(--v17-border, #e8e8e3)",
                  backgroundColor: "var(--v17-bg, var(--storefront-bg, #f5f5f0))",
                }}
              >
                {cat.image_url ? (
                  <img
                    src={optimizeImageUrl(cat.image_url, 150, 80)}
                    alt={cat.name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <div
                    className="flex h-full w-full items-center justify-center"
                    style={{ backgroundColor: "var(--v17-primary, #2B4C3F)", color: "#fff", fontSize: "22px", fontWeight: 600 }}
                  >
                    {cat.name.charAt(0)}
                  </div>
                )}
              </div>
              <span
                style={{
                  fontFamily: "var(--v17-body-font)",
                  fontSize: "12px",
                  fontWeight: 500,
                  color: "var(--v17-text, #000)",
                  textTransform: "capitalize",
                  textAlign: "center",
                  maxWidth: "80px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {cat.name}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Best Sellers Grid (non-carousel) ─── */
function V17BestSellersGrid({ bestSellers, slug, store }: { bestSellers: any[]; slug: string; store: StoreData }) {
  if (bestSellers.length === 0) return null;

  return (
    <section style={{ padding: "30px 15px 10px" }}>
      <div className="max-w-7xl mx-auto">
        <h2
          className="text-center"
          style={{
            fontFamily: "var(--v17-heading-font)",
            fontSize: "clamp(24px, 4vw, 36px)",
            fontWeight: 400,
            letterSpacing: "0.02em",
            color: "var(--v17-text, #000)",
            marginBottom: "8px",
          }}
        >
          Best Sellers
        </h2>
        <p
          className="text-center"
          style={{
            fontFamily: "var(--v17-body-font)",
            fontSize: "14px",
            fontWeight: 400,
            color: "var(--v17-text-muted, #666)",
            marginBottom: "30px",
          }}
        >
          Our most loved styles. Grab yours before they&apos;re gone.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4" style={{ gap: "15px", columnGap: "15px", rowGap: "30px" }}>
          {bestSellers.map((p: any, i: number) => (
            <V17CardWrapper key={p.id} product={p} slug={slug} store={store} priority={i < 2} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Main Home Component ─── */
export default function StorefrontHomeV17() {
  const params = useParams<{ slug: string }>();
  const store = useOutletContext<StoreData>();
  const slug = params.slug || (store as any)?.slug || "";
  const queryClient = useQueryClient();

  const _themeConfig = useStorefrontThemeConfig(store?.id);

  const { products, isLoading: productsLoading } = useStorefrontProducts(store?.id);
  const bsQuery = useBestSellingProducts(store?.id);
  const bestSellers = bsQuery.products;
  const useCarousel = store?.best_selling_carousel === true;
  const hasBestSellers = bestSellers.length > 0;

  const storeCategories = queryClient.getQueryData<any[]>(["storefront-categories", store?.id]);
  const categoriesLoading = storeCategories === undefined;

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
  const allProductIds = [...products.map((p: any) => p.id), ...bestSellers.map((p: any) => p.id)];

  const hasBanner = !!(store as any).banner_url;
  const hasMobileHero = !!(store as any).mobile_hero_url || !!(store as any).mobile_hero_images;

  return (
    <VariantCountProvider productIds={allProductIds}>
      {/* ─── Hero Banner — full-bleed behind transparent header ─── */}
      <section className="relative" style={{ marginTop: "-56px" }}>
        {hasBanner && (
          <div className="hidden md:block">
            <HeroBannerCarousel
              images={[(store as any).banner_url]}
              storeName={store.name}
              imageClassName="w-full h-auto object-cover"
              maxHeight="700px"
            />
          </div>
        )}
        {hasMobileHero && (
          <div className="md:hidden relative">
            <StorefrontMobileHero
              mobileHeroUrl={(store as any).mobile_hero_url}
              mobileHeroImages={(store as any).mobile_hero_images}
              storeName={store.name}
            />
            <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-20">
              <Link
                to={storefrontPath(slug, "shop")}
                className="inline-flex items-center justify-center px-8 py-3 rounded-full text-white font-medium text-sm tracking-wide shadow-lg transition-transform active:scale-95"
                style={{ backgroundColor: "var(--v17-primary, #0F2A22)", color: "var(--v17-bg, var(--storefront-bg, #fff))", minWidth: "180px" }}
              >
                Shop Collection
              </Link>
            </div>
          </div>
        )}
        {/* Desktop hero also gets the button */}
        {hasBanner && (
          <div className="hidden md:block absolute bottom-16 left-1/2 -translate-x-1/2 z-20">
            <Link
              to={storefrontPath(slug, "shop")}
              className="inline-flex items-center justify-center px-10 py-3.5 rounded-full text-white font-medium text-base tracking-wide shadow-lg hover:opacity-90 transition-all"
              style={{ backgroundColor: "var(--v17-primary, #0F2A22)", color: "var(--v17-bg, var(--storefront-bg, #fff))", minWidth: "200px" }}
            >
              Shop Collection
            </Link>
          </div>
        )}
      </section>

      {/* ─── Categories ─── */}
      <div style={{ paddingTop: "16px" }}>
      <UniversalCategories
        categories={storeCategories}
        storeSlug={slug}
        isLoading={categoriesLoading}
        categoryStyle={_themeConfig?.category_style || "style-1"}
      />
      </div>

      {/* ─── Best Sellers (carousel or grid) — appears before All Collection ─── */}
      {hasBestSellers && (
        useCarousel ? (
          <LazyRender rootMargin="200px">
            <section style={{ padding: "30px 15px" }}>
              <div className="max-w-7xl mx-auto">
                <h2
                  className="text-center"
                  style={{
                    fontFamily: "var(--v17-heading-font)",
                    fontSize: "clamp(24px, 4vw, 36px)",
                    fontWeight: 400,
                    letterSpacing: "0.02em",
                    color: "var(--v17-text, #000)",
                    marginBottom: "24px",
                  }}
                >
                  Best Sellers
                </h2>
                <Suspense fallback={null}>
                  <BestSellingCarousel products={bestSellers} slug={slug} store={store} cardStyle="style-1" />
                </Suspense>
              </div>
            </section>
          </LazyRender>
        ) : (
          <V17BestSellersGrid bestSellers={bestSellers} slug={slug} store={store} />
        )
      )}

      {/* ─── All Collection ─── */}
      <section style={{ padding: "40px 15px 20px" }}>
        <div className="max-w-7xl mx-auto">
          <h2
            className="text-center"
            style={{
              fontFamily: "var(--v17-heading-font)",
              fontSize: "clamp(24px, 4vw, 36px)",
              fontWeight: 400,
              letterSpacing: "0.02em",
              color: "var(--v17-text, #000)",
              marginBottom: "8px",
            }}
          >
            All Collection
          </h2>
          <p
            className="text-center"
            style={{
              fontFamily: "var(--v17-body-font)",
              fontSize: "14px",
              fontWeight: 400,
              color: "var(--v17-text-muted, #666)",
              marginBottom: "30px",
            }}
          >
            Unmatched design and superior comfort. <strong>Limited drop. No restocks.</strong>
          </p>

          {productsLoading ? (
            // Single-skeleton policy: edge-injected #sf-skel covers initial load
            <div style={{ minHeight: 520 }} />
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4" style={{ gap: "15px", columnGap: "15px", rowGap: "30px" }}>
                {aboveFold.map((p: any, i: number) => (
                  <V17CardWrapper key={p.id} product={p} slug={slug} store={store} priority={i < 2} index={i} />
                ))}
              </div>
              {belowFold.length > 0 && (
                <LazyRender rootMargin="200px">
                  <div className="grid grid-cols-2 md:grid-cols-4" style={{ gap: "15px", columnGap: "15px", rowGap: "30px", marginTop: "30px" }}>
                    {belowFold.map((p: any, i: number) => (
                      <V17CardWrapper key={p.id} product={p} slug={slug} store={store} index={i + ABOVE_FOLD_COUNT} />
                    ))}
                  </div>
                </LazyRender>
              )}
            </>
          )}

          {products.length > 0 && (
            <div className="text-center" style={{ marginTop: "35px" }}>
              <Link
                to={storefrontPath(slug, "/shop")}
                className="inline-flex items-center gap-2 transition-colors hover:opacity-80"
                style={{
                  padding: "10px 24px",
                  fontSize: "14px",
                  fontWeight: 500,
                  fontFamily: "var(--v17-body-font)",
                  borderRadius: "4px",
                  border: "2px solid var(--v17-primary, #2B4C3F)",
                  color: "var(--v17-primary, #2B4C3F)",
                  backgroundColor: "transparent",
                }}
              >
                View All Products <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          )}
        </div>
      </section>

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
