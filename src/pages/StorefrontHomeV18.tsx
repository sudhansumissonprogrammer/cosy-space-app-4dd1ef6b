/**
 * Theme 18 Home — Dark Streetwear layout:
 * 1. Full-screen Hero Banner carousel
 * 2. "Show-Runners" — featured product grid (edge-to-edge, 4-col desktop / 2-col mobile)
 * 3. "New Arrival" — product grid
 * 4. Newsletter + dark footer (handled by StorefrontFooter)
 *
 * All sections use a deep black (#0a0a0a) background with white text.
 * Product cards are borderless with full-bleed images for an editorial feel.
 */
import { lazy, Suspense } from "react";
import { useOutletContext, useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useStorefrontThemeConfig } from "@/hooks/useStorefrontThemeConfig";
import { useStorefrontProducts } from "@/hooks/useStorefrontProducts";
import { useBestSellingProducts } from "@/hooks/useBestSellingProducts";
import { ArrowRight } from "lucide-react";
import { VariantCountProvider } from "@/hooks/useVariantCounts";
import type { StoreData } from "@/layouts/StorefrontLayout";
import UniversalProductCard from "@/components/storefront/UniversalProductCard";
import StorefrontMobileHero from "@/components/storefront/StorefrontMobileHero";
import HeroBannerCarousel from "@/components/storefront/HeroBannerCarousel";
import LazyRender from "@/components/storefront/LazyRender";
import { useStoreJsonLd } from "@/hooks/useJsonLd";
import { storefrontPath } from "@/lib/subdomain";
import ProductCardSkeleton from "@/components/storefront/ProductCardSkeleton";
import SectionHeading from "@/components/storefront/SectionHeading";

const BestSellingCarousel = lazy(() => import("@/components/storefront/BestSellingCarousel"));
const StorefrontInstagramSection = lazy(() => import("@/components/storefront/StorefrontInstagramSection"));

const SHOW_RUNNER_COUNT = 4;

/* ─── Section Title — minimal white-on-black ─── */
function DarkSectionTitle({ title }: { title: string }) {
  return (
    <div className="py-6 md:py-8 text-center">
      <h2 className="text-2xl md:text-4xl font-bold tracking-tight" style={{ color: "#f5f5f5" }}>
        {title}
      </h2>
    </div>
  );
}

/* ─── Newsletter Section ─── */
function NewsletterSection() {
  return (
    <section className="py-12 px-6 border-t border-white/10">
      <div className="max-w-md mx-auto md:mx-0 md:max-w-none md:grid md:grid-cols-3 md:gap-12 max-w-6xl md:px-8">
        <div>
          <h3 className="text-sm font-bold tracking-widest uppercase mb-3" style={{ color: "#f5f5f5" }}>
            Newsletter
          </h3>
          <p className="text-sm leading-relaxed mb-4" style={{ color: "#999" }}>
            Sign up for our mailing list to be the first to receive updates about new products
          </p>
          <form className="flex gap-0 border-b border-white/30 pb-1" onSubmit={(e) => e.preventDefault()}>
            <input
              type="email"
              placeholder="Your email address"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-white/40"
              style={{ color: "#f5f5f5" }}
            />
            <button type="submit" className="text-white/60 hover:text-white transition-colors pl-2">
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}

/* ─── Main Home Component ─── */
export default function StorefrontHomeV18() {
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

  // Split products: first 4 as "Show-Runners", rest as "New Arrival"
  const showRunners = products.slice(0, SHOW_RUNNER_COUNT);
  const newArrivals = products.slice(SHOW_RUNNER_COUNT);
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
              maxHeight="100vh"
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
        {/* If no banners at all, show a dark placeholder */}
        {!hasBanner && !hasMobileHero && (
          <div className="w-full aspect-[16/9] md:aspect-[21/9] flex items-center justify-center" style={{ backgroundColor: "#111" }}>
            <h1 className="text-4xl md:text-7xl font-black tracking-tighter uppercase" style={{ color: "#f5f5f5" }}>
              {store.name}
            </h1>
          </div>
        )}
      </section>

      {/* ─── Show-Runners (Featured Products) ─── */}
      <section style={{ backgroundColor: "#0a0a0a" }}>
        <DarkSectionTitle title="Show-Runners" />
        {productsLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4">
            {Array.from({ length: SHOW_RUNNER_COUNT }).map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        ) : showRunners.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4">
            {showRunners.map((p: any, i: number) => (
              <div key={p.id} className="v18-product-card">
                <UniversalProductCard product={p} slug={slug} store={store} priority={i < 2} cardStyle={cardStyle} index={i} />
              </div>
            ))}
          </div>
        ) : null}
      </section>

      {/* ─── Best Sellers ─── */}
      {showBestSellers && (
        <LazyRender rootMargin="200px">
          <section className="py-6 px-4" style={{ backgroundColor: "#0a0a0a" }}>
            <div className="max-w-6xl mx-auto">
              <SectionHeading title="Best Sellers" />
              <Suspense fallback={null}>
                <BestSellingCarousel products={bestSellers} slug={slug} store={store} cardStyle={cardStyle} />
              </Suspense>
            </div>
          </section>
        </LazyRender>
      )}

      {/* ─── New Arrival ─── */}
      {newArrivals.length > 0 && (
        <LazyRender rootMargin="200px">
          <section style={{ backgroundColor: "#0a0a0a" }}>
            <DarkSectionTitle title="New Arrival" />
            <div className="grid grid-cols-2 md:grid-cols-4">
              {newArrivals.map((p: any, i: number) => (
                <div key={p.id} className="v18-product-card">
                  <UniversalProductCard product={p} slug={slug} store={store} cardStyle={cardStyle} index={i + SHOW_RUNNER_COUNT} />
                </div>
              ))}
            </div>
          </section>
        </LazyRender>
      )}

      {/* ─── View All ─── */}
      {products.length > 0 && (
        <div className="text-center py-10" style={{ backgroundColor: "#0a0a0a" }}>
          <Link
            to={storefrontPath(slug, "/shop")}
            className="inline-flex items-center gap-2 px-8 py-3 text-sm font-semibold tracking-wider uppercase border transition-colors hover:bg-white hover:text-black"
            style={{ borderColor: "#fff", color: "#f5f5f5" }}
          >
            Shop All <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}

      {/* ─── Newsletter ─── */}
      <LazyRender rootMargin="100px">
        <div style={{ backgroundColor: "#0a0a0a" }}>
          <NewsletterSection />
        </div>
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
