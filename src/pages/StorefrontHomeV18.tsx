/**
 * Theme 18 Home — Dark Streetwear layout:
 * 1. Full-screen Hero Banner carousel
 * 2. Categories
 * 3. Best Sellers (if enabled)
 * 4. New Arrivals — all products grid
 * 5. Newsletter + dark footer (handled by StorefrontFooter)
 */
import { lazy, Suspense } from "react";
import { useOutletContext, useParams, Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useStorefrontThemeConfig } from "@/hooks/useStorefrontThemeConfig";
import { useStorefrontProducts } from "@/hooks/useStorefrontProducts";
import { useBestSellingProducts } from "@/hooks/useBestSellingProducts";
import { ArrowRight } from "lucide-react";
import { VariantCountProvider } from "@/hooks/useVariantCounts";
import type { StoreData } from "@/layouts/StorefrontLayout";
import UniversalProductCard from "@/components/storefront/UniversalProductCard";
import UniversalCategories from "@/components/storefront/UniversalCategories";
import StorefrontMobileHero from "@/components/storefront/StorefrontMobileHero";
import HeroBannerCarousel from "@/components/storefront/HeroBannerCarousel";
import LazyRender from "@/components/storefront/LazyRender";
import { useStoreJsonLd } from "@/hooks/useJsonLd";
import { storefrontPath } from "@/lib/subdomain";
import ProductCardSkeleton from "@/components/storefront/ProductCardSkeleton";
import SectionHeading from "@/components/storefront/SectionHeading";

const StorefrontInstagramSection = lazy(() => import("@/components/storefront/StorefrontInstagramSection"));

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
  const store = useOutletContext<StoreData>();
  const slug = params.slug || (store as any)?.slug || "";
  const queryClient = useQueryClient();

  const themeConfig = useStorefrontThemeConfig(store?.id);
  const cardStyle = "style-5";
  const categoryStyle = themeConfig?.category_style || "style-1";

  const storeCategories = queryClient.getQueryData<any[]>(["storefront-categories", store?.id]);
  const categoriesLoading = storeCategories === undefined;

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

  const allProductIds = products.map((p: any) => p.id);
  const hasBanner = !!(store as any).banner_url;
  const hasMobileHero = !!(store as any).mobile_hero_url || !!(store as any).mobile_hero_images;

  return (
    <VariantCountProvider productIds={allProductIds}>
      {/* ─── Hero Banner ─── */}
      <section className="relative v18-hero-pull">
        {hasBanner && (
          <div className="hidden md:block relative">
            <HeroBannerCarousel
              images={[(store as any).banner_url]}
              storeName={store.name}
              imageClassName="w-full h-auto object-cover"
              maxHeight="100vh"
            />
            <div className="absolute inset-0 flex items-end justify-center pb-16">
              <Link
                to={storefrontPath(slug, "/categories")}
                className="inline-flex items-center gap-2 px-10 py-3.5 text-sm font-bold tracking-[0.2em] uppercase border-2 border-white/80 bg-black/30 backdrop-blur-sm transition-all hover:bg-white hover:!text-black [&:hover_svg]:!stroke-black"
                style={{ color: "#fff" }}
              >
                Shop Collection <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        )}
        {hasMobileHero && (
          <div className="md:hidden relative">
            <StorefrontMobileHero
              mobileHeroUrl={(store as any).mobile_hero_url}
              mobileHeroImages={(store as any).mobile_hero_images}
              storeName={store.name}
            />
            <div className="absolute inset-0 flex items-end justify-center pb-10">
              <Link
                to={storefrontPath(slug, "/categories")}
                className="inline-flex items-center gap-2 px-8 py-3 text-xs font-bold tracking-[0.2em] uppercase border-2 border-white/80 bg-black/30 backdrop-blur-sm transition-all hover:bg-white hover:!text-black [&:hover_svg]:!stroke-black"
                style={{ color: "#fff" }}
              >
                Shop Collection <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        )}
        {!hasBanner && !hasMobileHero && (
          <div className="w-full aspect-[16/9] md:aspect-[21/9] flex flex-col items-center justify-center gap-6" style={{ backgroundColor: "#111" }}>
            <h1 className="text-4xl md:text-7xl font-black tracking-tighter uppercase" style={{ color: "#f5f5f5" }}>
              {store.name}
            </h1>
            <Link
              to={storefrontPath(slug, "/categories")}
              className="inline-flex items-center gap-2 px-8 py-3 text-sm font-bold tracking-[0.2em] uppercase border-2 border-white/80 transition-all hover:bg-white hover:!text-black [&:hover_svg]:!stroke-black"
              style={{ color: "#f5f5f5" }}
            >
              Shop Collection <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </section>

      {/* ─── Categories ─── */}
      <div style={{ backgroundColor: "#0a0a0a", color: "#f5f5f5" }}>
        <UniversalCategories
          categories={storeCategories}
          storeSlug={slug}
          isLoading={categoriesLoading}
          categoryStyle={categoryStyle}
        />
      </div>

      {/* ─── Best Sellers ─── */}
      {showBestSellers && (
        <LazyRender rootMargin="200px">
          <section style={{ backgroundColor: "#0a0a0a" }}>
            <DarkSectionTitle title="Best Sellers" />
            <div className="grid grid-cols-2 md:grid-cols-4">
              {bestSellers.map((p: any, i: number) => (
                <div key={p.id} className="v18-product-card">
                  <UniversalProductCard product={p} slug={slug} store={store} priority={i < 2} cardStyle={cardStyle} index={i} />
                </div>
              ))}
            </div>
          </section>
        </LazyRender>
      )}

      {/* ─── New Arrivals ─── */}
      {products.length > 0 && (
        <section style={{ backgroundColor: "#0a0a0a" }}>
          <DarkSectionTitle title="New Arrivals" />
          {productsLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4">
              {products.map((p: any, i: number) => (
                <div key={p.id} className="v18-product-card">
                  <UniversalProductCard product={p} slug={slug} store={store} priority={i < 2} cardStyle={cardStyle} index={i} />
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ─── View All ─── */}
      {products.length > 0 && (
        <div className="text-center py-10" style={{ backgroundColor: "#0a0a0a" }}>
          <Link
            to={storefrontPath(slug, "/shop")}
            className="inline-flex items-center gap-2 px-8 py-3 text-sm font-semibold tracking-wider uppercase border transition-colors hover:bg-white hover:!text-black [&:hover_svg]:!stroke-black"
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
