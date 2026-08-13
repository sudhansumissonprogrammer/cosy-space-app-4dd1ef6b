import { useMemo, lazy, Suspense, type ReactNode } from "react";
import type { Tables } from "@/integrations/supabase/types";
import UniversalProductCard from "@/components/storefront/UniversalProductCard";
import SectionHeading from "@/components/storefront/SectionHeading";
import { DeferUntilVisible } from "@/components/storefront/DeferUntilVisible";
import BestSellerBadge from "@/components/storefront/BestSellerBadge";

const BestSellingCarousel = lazy(() => import("@/components/storefront/BestSellingCarousel"));
const ShopByVideoCarousel = lazy(() => import("@/components/storefront/ShopByVideoCarousel"));

type StoreData = Tables<"stores">;

/** Shared section header with optional "View All" link */
export function HomeSectionHeader({ title, slug, linkTo }: { title: ReactNode; slug: string; linkTo?: string; fontFallback?: string }) {
  return (
    <div className="px-4 lg:px-6">
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
      <HomeSectionHeader title={<span className="inline-flex items-center gap-2">Best Selling<BestSellerBadge /></span>} slug={slug} linkTo="shop" />
      {useCarousel ? (
        <div className="px-4 lg:px-6">
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
          <div className="hidden md:grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5 lg:gap-6 px-4 lg:px-6">
            {bestSellers.map((product: any, idx: number) => (
              <UniversalProductCard key={product.id} product={product} slug={slug} store={store} priority={idx < 4} cardStyle={cardStyle} index={idx} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** Shop by Video section — mounted below Best Sellers on V10/V12 shared home. */
export function HomeShopByVideoSection({ slug, store }: { slug: string; store: StoreData }) {
  return (
    <div className="py-4 px-4 lg:px-6">
      <Suspense fallback={null}>
        <DeferUntilVisible rootMargin="600px" minHeight={0}>
          <ShopByVideoCarousel storeSlug={slug} storeId={store.id} />
        </DeferUntilVisible>
      </Suspense>
    </div>
  );
}

/** Responsive hero: mobile_hero_images on mobile, banner_url on desktop.
 *  A configured hero video replaces the image hero for that surface. */
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

  const mobileVideo = ((store as any).mobile_hero_video_url || "").trim?.() || "";
  const desktopVideo = ((store as any).desktop_hero_video_url || "").trim?.() || "";

  return (
    <>
      <div className="block md:hidden">
        {mobileVideo ? (
          <Suspense fallback={<div className="w-full" style={{ aspectRatio: "4/5" }} />}>
            <HeroVideo
              src={mobileVideo}
              poster={(store as any).mobile_hero_video_poster || mobileImages[0] || null}
              storeName={store.name}
              posterWidth={800}
              aspectRatio="4/5"
              mediaClassName="w-full h-full block object-cover"
            />
          </Suspense>
        ) : mobileImages.length > 0 ? (
          <HeroBannerCarousel images={mobileImages} storeName={store.name} interval={2000} imageClassName="w-full h-auto object-cover" maxHeight="520px" />
        ) : null}
      </div>
      <div className="hidden md:block">
        {desktopVideo ? (
          <Suspense fallback={<div className="w-full" style={{ aspectRatio: "16/7" }} />}>
            <HeroVideo
              src={desktopVideo}
              poster={(store as any).desktop_hero_video_poster || desktopImages[0] || null}
              storeName={store.name}
              posterWidth={1200}
              aspectRatio="16/7"
              mediaClassName="w-full h-full block object-cover"
            />
          </Suspense>
        ) : desktopImages.length > 0 ? (
          <HeroBannerCarousel images={desktopImages} storeName={store.name} interval={2000} imageClassName="w-full h-auto object-cover" maxHeight="90vh" />
        ) : null}
      </div>
    </>
  );
}
