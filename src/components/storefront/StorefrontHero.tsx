import { useEffect } from "react";
import { BadgeCheck } from "lucide-react";
import StoreTextLogo from "@/components/storefront/StoreTextLogo";
import { optimizeImageUrl, getImageSrcSet, preloadHeroImage, HERO_IMAGE_SIZES } from "@/lib/imageOptimize";
import type { StoreData } from "@/layouts/StorefrontLayout";

interface StorefrontHeroProps {
  store: StoreData;
}

export default function StorefrontHero({ store }: StorefrontHeroProps) {
  // Preload the banner for LCP
  useEffect(() => {
    if (store.banner_url) {
      return preloadHeroImage(store.banner_url, 1200);
    }
  }, [store.banner_url]);

  return (
    <section className="relative">
      {store.banner_url ? (
        <div className="h-56 w-full sm:h-72 lg:h-80 xl:h-[360px] 2xl:h-[90vh] 2xl:max-h-[720px]">
          <img
            src={optimizeImageUrl(store.banner_url, 1200, 75)}
            srcSet={getImageSrcSet(store.banner_url, [400, 800, 1200]) || undefined}
            sizes={HERO_IMAGE_SIZES}
            alt={`${store.name} banner`}
            className="h-full w-full object-cover"
            loading="eager"
            fetchPriority="high"
            decoding="sync"
            width={1200}
            height={400}
          />
          <div className="absolute inset-0" style={{ background: "linear-gradient(to top, var(--storefront-bg, hsl(var(--background))) 0%, color-mix(in srgb, var(--storefront-bg, hsl(var(--background))) 40%, transparent) 50%, transparent 100%)" }} />
        </div>
      ) : (
        <div className="h-56 w-full sm:h-72 lg:h-80 xl:h-[360px] 2xl:h-[90vh] 2xl:max-h-[720px]" style={{ background: "linear-gradient(to bottom right, color-mix(in srgb, var(--storefront-primary, hsl(var(--primary))) 20%, transparent), color-mix(in srgb, var(--storefront-primary, hsl(var(--primary))) 10%, var(--storefront-bg, hsl(var(--background)))))" }}>
          <div className="absolute inset-0" style={{ background: "linear-gradient(to top, color-mix(in srgb, var(--storefront-bg, hsl(var(--background))) 80%, transparent), transparent)" }} />
        </div>
      )}
      <div className="absolute inset-0 flex items-end">
        <div className="mx-auto w-full max-w-6xl lg:max-w-7xl px-4 pb-6 lg:pb-10">
          <div className="flex items-end gap-4">
            {store.logo_url ? (
              <img
                src={optimizeImageUrl(store.logo_url, 96, 80)}
                alt={store.name}
                className="h-20 w-20 rounded-2xl object-cover shadow-lg sm:h-24 sm:w-24"
                style={{ border: "4px solid var(--storefront-bg, hsl(var(--background)))" }}
                loading="eager"
                width={96}
                height={96}
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl shadow-lg sm:h-24 sm:w-24" style={{ border: "4px solid var(--storefront-bg, hsl(var(--background)))", backgroundColor: "var(--storefront-bg, hsl(var(--card)))" }}>
                <StoreTextLogo storeName={store.name} size="text-sm" className="text-center leading-tight px-1 break-words whitespace-normal" />
              </div>
            )}
            <div className="mb-1 min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold sm:text-3xl lg:text-4xl" style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }}>{store.name}</h1>
                {store.is_verified && (
                  <BadgeCheck className="h-5 w-5" style={{ color: "var(--storefront-primary, hsl(var(--primary)))" }} />
                )}
              </div>
              {store.description && (
                <p className="mt-1 max-w-xl text-sm lg:text-base line-clamp-2" style={{ color: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 60%, transparent)" }}>
                  {store.description}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
