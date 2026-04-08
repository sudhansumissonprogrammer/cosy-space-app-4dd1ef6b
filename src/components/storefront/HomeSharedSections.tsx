import { useMemo, lazy, Suspense } from "react";
import type { Tables } from "@/integrations/supabase/types";
import UniversalProductCard from "@/components/storefront/UniversalProductCard";
import SectionHeading from "@/components/storefront/SectionHeading";

const BestSellingCarousel = lazy(() => import("@/components/storefront/BestSellingCarousel"));

type StoreData = Tables<"stores">;

/** Shared section header with optional "View All" link */
export function HomeSectionHeader({ title, slug, linkTo }: { title: string; slug: string; linkTo?: string; fontFallback?: string }) {
  return (
    <div className="px-4">
      <SectionHeading title={title} slug={slug} linkTo={linkTo} />
    </div>
  );
}

/** Best selling section — respects store carousel setting. Shared by V10/V12 */
export function HomeBestSellingSection({ products, slug, store, cardStyle, bestSellers: bestSellersProp }: { products: any[]; slug: string; store: StoreData; cardStyle: string; bestSellers?: any[] }) {
  const filteredBestSellers = useMemo(() => products.filter((p: any) => p.is_best_selling), [products]);
  const bestSellers = bestSellersProp && bestSellersProp.length > 0 ? bestSellersProp : filteredBestSellers;
  if (bestSellers.length === 0) return null;

  const useCarousel = (store as any).best_selling_carousel;

  return (
    <div className="py-4">
      <HomeSectionHeader title="Best Selling" slug={slug} linkTo="shop" />
      {useCarousel ? (
        <div className="px-4">
          <Suspense fallback={null}>
            <BestSellingCarousel products={bestSellers} slug={slug} store={store} cardStyle={cardStyle} />
          </Suspense>
        </div>
      ) : (
        <>
          <div className="flex gap-3 overflow-x-auto px-4 pb-2 md:hidden rubber-band-scroll" style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
            {bestSellers.map((product: any, idx: number) => (
              <div key={product.id} className="flex-shrink-0" style={{ width: "160px" }}>
                <UniversalProductCard product={product} slug={slug} store={store} priority={idx < 4} cardStyle={cardStyle} index={idx} />
              </div>
            ))}
          </div>
          <div className="hidden md:grid grid-cols-3 lg:grid-cols-4 gap-4 px-4">
            {bestSellers.map((product: any, idx: number) => (
              <UniversalProductCard key={product.id} product={product} slug={slug} store={store} priority={idx < 4} cardStyle={cardStyle} index={idx} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** Responsive hero: mobile_hero_images on mobile, banner_url on desktop */
export function ResponsiveHeroBanner({ store, HeroBannerCarousel }: { store: StoreData; HeroBannerCarousel: any }) {
  const mobileImages: string[] = [];
  const mhi = (store as any).mobile_hero_images;
  if (mhi && Array.isArray(mhi) && mhi.length > 0) {
    mobileImages.push(...mhi);
  } else if (store.mobile_hero_url) {
    mobileImages.push(store.mobile_hero_url);
  }
  const desktopImages: string[] = [];
  if (store.banner_url) {
    desktopImages.push(store.banner_url);
  }

  return (
    <>
      {mobileImages.length > 0 && (
        <div className="block md:hidden">
          <HeroBannerCarousel images={mobileImages} storeName={store.name} interval={2000} imageClassName="w-full h-auto object-cover" maxHeight="520px" />
        </div>
      )}
      {desktopImages.length > 0 && (
        <div className="hidden md:block">
          <HeroBannerCarousel images={desktopImages} storeName={store.name} interval={2000} imageClassName="w-full h-auto object-cover" maxHeight="520px" />
        </div>
      )}
    </>
  );
}
