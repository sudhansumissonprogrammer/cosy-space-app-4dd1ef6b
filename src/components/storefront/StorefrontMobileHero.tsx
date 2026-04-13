import { useState, useCallback, useEffect, useRef } from "react";
import { optimizeImageUrl, getImageSrcSet, preloadHeroImage, HERO_IMAGE_SIZES } from "@/lib/imageOptimize";

interface StorefrontMobileHeroProps {
  mobileHeroUrl: string | null | undefined;
  mobileHeroImages?: unknown;
  storeName: string;
}

function normalizeHeroImages(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    const raw = value.trim();
    if (!raw) return [];

    if (raw.startsWith("[") && raw.endsWith("]")) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed
            .filter((item): item is string => typeof item === "string")
            .map((item) => item.trim())
            .filter(Boolean);
        }
      } catch {
        // fall back to comma-split below
      }
    }

    return raw
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

export default function StorefrontMobileHero({ mobileHeroUrl, mobileHeroImages, storeName }: StorefrontMobileHeroProps) {
  const slides = normalizeHeroImages(mobileHeroImages);
  const fallbackHero = mobileHeroUrl?.trim();

  if (fallbackHero && !slides.includes(fallbackHero)) {
    slides.push(fallbackHero);
  }

  const uniqueSlides = Array.from(new Set(slides));

  // Preload first image — must be before any early return
  useEffect(() => {
    if (uniqueSlides.length > 0) {
      return preloadHeroImage(uniqueSlides[0], 800);
    }
  }, [uniqueSlides[0]]);

  if (uniqueSlides.length === 0) return null;

  // Single image — render directly at natural aspect ratio
  if (uniqueSlides.length === 1) {
    const src = uniqueSlides[0];
    const srcSet = getImageSrcSet(src, [400, 600, 800]);
    return (
      <div className="block md:hidden w-full h-full" style={{ contain: "layout style" }}>
        <img
          src={optimizeImageUrl(src, 800)}
          srcSet={srcSet || undefined}
          sizes="100vw"
          alt={`${storeName} hero banner`}
          className="w-full h-full block object-cover"
          loading="eager"
          fetchPriority="high"
          decoding="sync"
          draggable={false}
          width={800}
          height={1000}
        />
      </div>
    );
  }

  // Multiple images — simple carousel at natural aspect ratio
  return (
    <div className="block md:hidden w-full" style={{ contain: "layout style" }}>
      <MobileHeroCarousel images={uniqueSlides} storeName={storeName} />
    </div>
  );
}

function MobileHeroCarousel({ images, storeName }: { images: string[]; storeName: string }) {
  const [current, setCurrent] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dragStartRef = useRef<number | null>(null);
  const dragCurrentRef = useRef<number | null>(null);
  const len = images.length;

  const next = useCallback(() => setCurrent((c) => (c + 1) % len), [len]);
  const prev = useCallback(() => setCurrent((c) => (c - 1 + len) % len), [len]);

  useEffect(() => {
    intervalRef.current = setInterval(next, 4000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [next]);

  const resetTimer = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(next, 4000);
  }, [next]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    dragStartRef.current = e.touches[0].clientX;
    dragCurrentRef.current = e.touches[0].clientX;
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (dragStartRef.current === null || e.touches.length !== 1) return;
    dragCurrentRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (dragStartRef.current === null) return;
    const diff = (dragCurrentRef.current ?? dragStartRef.current) - dragStartRef.current;
    dragStartRef.current = null;
    dragCurrentRef.current = null;
    if (Math.abs(diff) > 50) {
      if (diff < 0) next(); else prev();
    }
    resetTimer();
  };

  return (
    <div className="relative overflow-hidden touch-pan-y w-full">
      <div
        className="flex transition-transform duration-500 ease-out select-none"
        style={{ transform: `translateX(-${current * 100}%)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {images.map((url, i) => {
          const srcSet = getImageSrcSet(url, [400, 600, 800]);
          return (
            <div key={i} className="w-full flex-shrink-0">
              <img
                src={optimizeImageUrl(url, 800)}
                srcSet={srcSet || undefined}
                sizes="100vw"
                alt={`${storeName} hero ${i + 1}`}
                className="w-full h-auto block"
                loading={i === 0 ? "eager" : "lazy"}
                fetchPriority={i === 0 ? "high" : "auto"}
                decoding={i === 0 ? "sync" : "async"}
                draggable={false}
              />
            </div>
          );
        })}
      </div>

      {/* Dots */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex gap-2">
        {images.map((_, i) => (
          <button
            key={i}
            onClick={() => { setCurrent(i); resetTimer(); }}
            className={`h-2.5 rounded-full transition-all duration-300 ${
              i === current ? "w-6 bg-white" : "w-2.5 bg-white/50"
            }`}
            aria-label={`Go to slide ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

