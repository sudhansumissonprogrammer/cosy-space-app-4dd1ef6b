import { useState, useCallback, useEffect, useRef } from "react";
import { optimizeImageUrl, getImageSrcSet, preloadHeroImage, HERO_IMAGE_SIZES } from "@/lib/imageOptimize";

/**
 * Shared parallax hook — applies a gentle vertical translate on scroll.
 * The container MUST have overflow:hidden so the slight over-height is invisible.
 */
function useParallax(speed = 0.12) {
  const imgRef = useRef<HTMLImageElement>(null);
  const ticking = useRef(false);

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;

    // Only apply parallax on desktop — mobile uses natural aspect ratio
    // and translateY would clip the image
    const mq = window.matchMedia("(min-width: 768px)");
    if (!mq.matches) return;

    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(() => {
        const parent = img.parentElement?.closest("[data-parallax-root]") || img.parentElement;
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

  return imgRef;
}

interface HeroBannerCarouselProps {
  images: string[];
  storeName: string;
  optimizeWidth?: number;
  interval?: number;
  className?: string;
  imageClassName?: string;
  maxHeight?: string;
  overlay?: React.ReactNode;
}

export default function HeroBannerCarousel({
  images,
  storeName,
  optimizeWidth = 800,
  interval = 4000,
  className = "",
  imageClassName = "w-full h-auto object-cover",
  maxHeight,
  overlay,
}: HeroBannerCarouselProps) {
  useEffect(() => {
    if (images.length > 0) {
      return preloadHeroImage(images[0], optimizeWidth);
    }
  }, [images, optimizeWidth]);

  if (images.length === 0) return null;

  if (images.length === 1) {
    return (
      <SingleHeroWithParallax
        image={images[0]}
        storeName={storeName}
        optimizeWidth={optimizeWidth}
        className={className}
        imageClassName={imageClassName}
        maxHeight={maxHeight}
        overlay={overlay}
      />
    );
  }

  return (
    <CarouselInner
      images={images}
      storeName={storeName}
      optimizeWidth={optimizeWidth}
      interval={interval}
      className={className}
      imageClassName={imageClassName}
      maxHeight={maxHeight}
      overlay={overlay}
    />
  );
}

/** Single image with parallax */
function SingleHeroWithParallax({
  image, storeName, optimizeWidth, className, imageClassName, maxHeight, overlay,
}: {
  image: string; storeName: string; optimizeWidth: number;
  className?: string; imageClassName?: string; maxHeight?: string; overlay?: React.ReactNode;
}) {
  const imgRef = useParallax();
  const srcSet = getImageSrcSet(image, [400, 600, 800, 1200]);

  return (
    <div data-parallax-root className={`relative overflow-hidden ${className}`} style={{ aspectRatio: "16/7", contain: "layout" }}>
      <img
        ref={imgRef}
        src={optimizeImageUrl(image, optimizeWidth)}
        srcSet={srcSet || undefined}
        sizes={HERO_IMAGE_SIZES}
        alt={`${storeName} hero banner`}
        className={`${imageClassName} will-change-transform`}
        style={maxHeight ? { maxHeight } : undefined}
        loading="eager"
        fetchPriority="high"
        decoding="sync"
        width={1200}
        height={600}
      />
      {overlay}
    </div>
  );
}

/** Defers rendering of non-visible carousel slides to reduce initial payload */
function DeferredSlide({
  url, optimizeWidth, srcSet, storeName, index, imageClassName, maxHeight, isVisible,
}: {
  url: string; optimizeWidth: number; srcSet: string; storeName: string;
  index: number; imageClassName?: string; maxHeight?: string; isVisible: boolean;
}) {
  const [hasBeenVisible, setHasBeenVisible] = useState(false);
  useEffect(() => {
    if (isVisible && !hasBeenVisible) setHasBeenVisible(true);
  }, [isVisible, hasBeenVisible]);

  if (!hasBeenVisible) {
    return <div className={imageClassName} style={{ ...(maxHeight ? { maxHeight } : {}), aspectRatio: "2/1" }} />;
  }

  return (
    <img
      src={optimizeImageUrl(url, optimizeWidth)}
      srcSet={srcSet || undefined}
      sizes={HERO_IMAGE_SIZES}
      alt={`${storeName} hero banner ${index + 1}`}
      className={imageClassName}
      style={maxHeight ? { maxHeight } : undefined}
      loading="lazy"
      decoding="async"
      width={1200}
      height={600}
      draggable={false}
    />
  );
}

function CarouselInner({
  images, storeName, optimizeWidth, interval, className, imageClassName, maxHeight, overlay,
}: Required<Pick<HeroBannerCarouselProps, "images" | "storeName" | "optimizeWidth" | "interval">> &
  Pick<HeroBannerCarouselProps, "className" | "imageClassName" | "maxHeight" | "overlay">) {
  const [current, setCurrent] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dragStartRef = useRef<number | null>(null);
  const dragCurrentRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const ticking = useRef(false);
  const len = images.length;

  const goTo = useCallback((idx: number) => setCurrent((idx + len) % len), [len]);
  const next = useCallback(() => setCurrent((c) => (c + 1) % len), [len]);
  const prev = useCallback(() => setCurrent((c) => (c - 1 + len) % len), [len]);

  // Parallax on whole carousel container
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Desktop only — mobile clips with translateY
    const mq = window.matchMedia("(min-width: 768px)");
    if (!mq.matches) return;

    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect();
        if (rect.bottom > 0 && rect.top < window.innerHeight) {
          const imgs = el.querySelectorAll<HTMLImageElement>("[data-parallax-img]");
          const offset = rect.top * 0.12;
          imgs.forEach((img) => {
            img.style.transform = `translate3d(0, ${offset}px, 0)`;
          });
        }
        ticking.current = false;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Auto-play
  useEffect(() => {
    intervalRef.current = setInterval(next, interval);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [next, interval]);

  const resetTimer = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(next, interval);
  }, [next, interval]);

  const handleDragEnd = useCallback((diff: number) => {
    if (Math.abs(diff) > 50) { if (diff < 0) next(); else prev(); }
    resetTimer();
  }, [next, prev, resetTimer]);

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
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (dragStartRef.current === null) return;
    const endX = dragCurrentRef.current ?? e.changedTouches[0]?.clientX ?? dragStartRef.current;
    handleDragEnd(endX - dragStartRef.current);
    dragStartRef.current = null;
    dragCurrentRef.current = null;
  };
  const handleTouchCancel = () => { dragStartRef.current = null; dragCurrentRef.current = null; resetTimer(); };

  const handleMouseDown = (e: React.MouseEvent) => {
    dragStartRef.current = e.clientX;
    isDraggingRef.current = true;
    if (intervalRef.current) clearInterval(intervalRef.current);
    e.preventDefault();
  };
  const handleMouseMove = (e: React.MouseEvent) => { if (isDraggingRef.current) e.preventDefault(); };
  const handleMouseUp = (e: React.MouseEvent) => {
    if (!isDraggingRef.current || dragStartRef.current === null) return;
    isDraggingRef.current = false;
    handleDragEnd(e.clientX - dragStartRef.current);
    dragStartRef.current = null;
  };
  const handleMouseLeave = () => {
    if (isDraggingRef.current) { isDraggingRef.current = false; dragStartRef.current = null; resetTimer(); }
  };

  return (
    <div ref={containerRef} className={`relative overflow-hidden touch-pan-y group ${className || ""}`} style={{ aspectRatio: "16/7", contain: "layout" }} role="region" aria-label={`${storeName} banner slideshow`}>
      <div
        className="flex transition-transform duration-500 ease-out select-none"
        style={{ transform: `translateX(-${current * 100}%)`, cursor: "grab" }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        {images.map((url, i) => {
          const isFirst = i === 0;
          const srcSet = getImageSrcSet(url, [400, 600, 800, 1200]);
          return (
            <div key={i} className="w-full flex-shrink-0">
              {i <= 1 ? (
                <img
                  data-parallax-img
                  src={optimizeImageUrl(url, optimizeWidth)}
                  srcSet={srcSet || undefined}
                  sizes={HERO_IMAGE_SIZES}
                  alt={`${storeName} hero banner ${i + 1}`}
                  className={`${imageClassName} will-change-transform`}
                  style={maxHeight ? { maxHeight } : undefined}
                  loading={isFirst ? "eager" : "lazy"}
                  fetchPriority={isFirst ? "high" : "auto"}
                  decoding={isFirst ? "sync" : "async"}
                  width={1200}
                  height={600}
                  draggable={false}
                />
              ) : (
                <DeferredSlide
                  url={url}
                  optimizeWidth={optimizeWidth}
                  srcSet={srcSet}
                  storeName={storeName}
                  index={i}
                  imageClassName={imageClassName}
                  maxHeight={maxHeight}
                  isVisible={i === current}
                />
              )}
            </div>
          );
        })}
      </div>

      {overlay}

      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex gap-1.5">
        {images.map((_, i) => (
          <button
            key={i}
            onClick={() => { goTo(i); resetTimer(); }}
            className={`h-2 rounded-full transition-all duration-300 ${i === current ? "w-5 bg-white" : "w-2 bg-white/50"}`}
            aria-label={`Go to slide ${i + 1}`}
          />
        ))}
      </div>

      <button onClick={() => { prev(); resetTimer(); }} className="absolute left-2 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full bg-black/30 hover:bg-black/50 text-white flex items-center justify-center transition-opacity opacity-0 group-hover:opacity-100 sm:opacity-70" aria-label="Previous slide">‹</button>
      <button onClick={() => { next(); resetTimer(); }} className="absolute right-2 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full bg-black/30 hover:bg-black/50 text-white flex items-center justify-center transition-opacity opacity-0 group-hover:opacity-100 sm:opacity-70" aria-label="Next slide">›</button>
    </div>
  );
}
