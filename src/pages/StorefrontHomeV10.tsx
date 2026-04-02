import { useMemo, lazy, Suspense } from "react";
import { useOutletContext, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useStorefrontThemeConfig } from "@/hooks/useStorefrontThemeConfig";
import { useStorefrontProducts } from "@/hooks/useStorefrontProducts";
import { useBestSellingProducts } from "@/hooks/useBestSellingProducts";
import { Tag } from "lucide-react";
import type { StoreData } from "@/layouts/StorefrontLayout";
import UniversalProductCard from "@/components/storefront/UniversalProductCard";
import UniversalCategories from "@/components/storefront/UniversalCategories";
import { useStoreJsonLd } from "@/hooks/useJsonLd";
import { Skeleton } from "@/components/ui/skeleton";
const StorefrontInstagramSection = lazy(() => import("@/components/storefront/StorefrontInstagramSection"));
const StorefrontTrustStrip = lazy(() => import("@/components/storefront/StorefrontTrustStrip"));
import HeroBannerCarousel from "@/components/storefront/HeroBannerCarousel";
import { ResponsiveHeroBanner, HomeBestSellingSection, HomeSectionHeader } from "@/components/storefront/HomeSharedSections";

/* ── Announcement Strip ── */
function AnnouncementStrip({ customText }: { customText?: string }) {
  const DEFAULT_TEXT = "🚚 Free Shipping On All Orders • 🔄 Easy Returns • 🔒 Secure Payments • 💰 COD Available";
  const displayText = customText || DEFAULT_TEXT;
  const segments = displayText.split(" • ").filter(Boolean);

  return (
    <div
      className="w-full overflow-hidden py-2.5"
      style={{
        background: "var(--storefront-marquee-gradient, linear-gradient(90deg, #1a1a1a, #333, #1a1a1a))",
        color: "#ffffff",
      }}
    >
      <div className="flex w-max animate-marquee">
        {[0, 1].map((group) => (
          <div key={group} className="flex items-center gap-6 pr-6 md:gap-10 md:pr-10">
            {segments.map((segment, idx) => (
              <span key={`${group}-${idx}`} className="flex items-center gap-1.5 whitespace-nowrap text-[12px] font-semibold">
                <span>{segment.trim()}</span>
                {idx < segments.length - 1 && <span className="opacity-60">•</span>}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Story Section ── */
function StorySection({ store }: { store: StoreData }) {
  if (!store.description) return null;
  return (
    <div className="mx-4 my-4 p-6 text-center" style={{ backgroundColor: "var(--storefront-accent, #3d1c28)", color: "var(--storefront-bg, #f7f5f0)", borderRadius: "12px" }}>
      <p className="text-sm leading-relaxed opacity-80 italic max-w-md mx-auto">"{store.description}"</p>
    </div>
  );
}

/* ── Main Home Page — shared by V10 and V12 ── */
export function ElegantHomePage({ defaultCardStyle = "style-2", defaultCategoryStyle = "style-1", marqueeGradientDefault = "linear-gradient(90deg, #1a1a1a, #333, #1a1a1a)" }: { defaultCardStyle?: string; defaultCategoryStyle?: string; marqueeGradientDefault?: string }) {
  const store = useOutletContext<StoreData>();
  const { slug } = useParams<{ slug: string }>();
  const queryClient = useQueryClient();

  useStoreJsonLd({
    storeName: store.name,
    storeSlug: store.slug,
    description: store.description,
    logo: store.logo_url,
    location: store.location,
    whatsappNumber: store.whatsapp_number,
    customDomain: (store as any)?.custom_domain,
  });

  const { products, isLoading: isProductsLoading } = useStorefrontProducts(store.id);
  const storeCategories = queryClient.getQueryData<any[]>(["storefront-categories", store.id]);
  const themeConfig = useStorefrontThemeConfig(store.id);
  const cardStyle = themeConfig?.product_card_style || defaultCardStyle;
  const categoryStyle = themeConfig?.category_style || defaultCategoryStyle;
  const effectiveSlug = slug || store.slug;

  return (
    <div>
      <ResponsiveHeroBanner store={store} HeroBannerCarousel={HeroBannerCarousel} />
      <UniversalCategories categories={storeCategories} storeSlug={effectiveSlug} categoryStyle={categoryStyle} />
      {(themeConfig?.marquee_enabled ?? true) && <AnnouncementStrip customText={themeConfig?.marquee_text} />}
      {products && products.length > 0 && (
        <HomeBestSellingSection products={products} slug={effectiveSlug} store={store} cardStyle={cardStyle} />
      )}
      <StorySection store={store} />
      <div className="py-4">
        <HomeSectionHeader title="Curated For You" slug={effectiveSlug} linkTo="shop" />
        {isProductsLoading ? (
          <div className="grid grid-cols-2 gap-1.5 sm:gap-4 px-2 sm:px-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-72 rounded-lg" />
            ))}
          </div>
        ) : (() => {
          const popularProducts = products.filter((p: any) => !p.is_best_selling).slice(0, 10);
          return popularProducts.length > 0 ? (
            <div className="grid grid-cols-2 gap-1.5 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 px-2 sm:px-4">
              {popularProducts.map((product: any, idx: number) => (
                <UniversalProductCard key={product.id} product={product} slug={effectiveSlug} store={store} priority={idx < 4} cardStyle={cardStyle} />
              ))}
            </div>
          ) : (
            <div className="flex min-h-[60vh] items-center justify-center">
              <div className="text-center space-y-2">
                <Tag className="h-12 w-12 mx-auto" style={{ color: "var(--storefront-text, #1a1a1a)20" }} />
                <p className="text-sm" style={{ color: "var(--storefront-text, #1a1a1a)60" }}>No products available yet.</p>
              </div>
            </div>
          );
        })()}
      </div>
      <Suspense fallback={null}>
        <StorefrontTrustStrip storeId={store.id} currency={store.currency} />
      </Suspense>
      <Suspense fallback={null}>
        <StorefrontInstagramSection store={store} />
      </Suspense>
    </div>
  );
}

export default function StorefrontHomeV10() {
  return <ElegantHomePage defaultCardStyle="style-2" defaultCategoryStyle="style-1" />;
}
