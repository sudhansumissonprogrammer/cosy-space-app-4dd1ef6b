import { useEffect, useRef } from "react";
import { BadgeCheck } from "lucide-react";
import StoreTextLogo from "@/components/storefront/StoreTextLogo";
import { optimizeImageUrl, getImageSrcSet, preloadHeroImage, HERO_IMAGE_SIZES } from "@/lib/imageOptimize";
import type { StoreData } from "@/layouts/StorefrontLayout";

interface StorefrontHeroProps {
  store: StoreData;
}

/** Gentle parallax — translate only, no scale, no clipping */
function useHeroParallax(speed = 0.12) {
  const ref = useRef<HTMLImageElement>(null);
  const ticking = useRef(false);

  useEffect(() => {
    // Desktop only — mobile has fixed-height container that clips
    const mq = window.matchMedia("(min-width: 768px)");
    if (!mq.matches) return;

    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(() => {
        const parent = img.parentElement;
        if (!parent) { ticking.current = false; return; }
        const rect = parent.getBoundingClientRect();
        if (rect.bottom > 0 && rect.top < window.innerHeight) {
          const offset = rect.top * speed;
          img.style.transform = `translate3d(0, ${offset}px, 0)`;
        }
        ticking.current = false;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [speed]);

  return ref;
}

export default function StorefrontHero({ store }: StorefrontHeroProps) {
  useEffect(() => {
    if (store.banner_url) {
      return preloadHeroImage(store.banner_url, 1200);
    }
  }, [store.banner_url]);

  const imgRef = useHeroParallax();

  return (
    <section className="relative">
      {store.banner_url ? (
        <div className="h-56 w-full sm:h-72 lg:h-80 overflow-hidden">
          <img
            ref={imgRef}
            src={optimizeImageUrl(store.banner_url, 1200, 75)}
            srcSet={getImageSrcSet(store.banner_url, [400, 800, 1200]) || undefined}
            sizes={HERO_IMAGE_SIZES}
            alt={`${store.name} banner`}
            className="h-full w-full object-cover will-change-transform"
            loading="eager"
            fetchPriority="high"
            decoding="sync"
            width={1200}
            height={400}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/40 to-transparent" />
        </div>
      ) : (
        <div className="h-56 w-full bg-gradient-to-br from-primary/20 via-accent to-primary/10 sm:h-72 lg:h-80">
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
        </div>
      )}
      <div className="absolute inset-0 flex items-end">
        <div className="mx-auto w-full max-w-6xl px-4 pb-6">
          <div className="flex items-end gap-4">
            {store.logo_url ? (
              <img
                src={optimizeImageUrl(store.logo_url, 96, 80)}
                alt={store.name}
                className="h-20 w-20 rounded-2xl border-4 border-background object-cover shadow-lg sm:h-24 sm:w-24"
                loading="eager"
                width={96}
                height={96}
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl border-4 border-background bg-card shadow-lg sm:h-24 sm:w-24">
                <StoreTextLogo storeName={store.name} size="text-sm" className="text-center leading-tight px-1 break-words whitespace-normal" />
              </div>
            )}
            <div className="mb-1 min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-foreground sm:text-3xl">{store.name}</h1>
                {store.is_verified && (
                  <BadgeCheck className="h-5 w-5 text-primary" />
                )}
              </div>
              {store.description && (
                <p className="mt-1 max-w-xl text-sm text-muted-foreground line-clamp-2">
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
