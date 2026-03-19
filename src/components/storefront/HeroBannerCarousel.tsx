import { useState, useCallback, useEffect, useRef } from "react";
import { optimizeImageUrl } from "@/lib/imageOptimize";

interface HeroBannerCarouselProps {
  images: string[];
  storeName: string;
  /** Image optimization width (default 800) */
  optimizeWidth?: number;
  /** Auto-play interval in ms (default 2000) */
  interval?: number;
  /** CSS class for the wrapper */
  className?: string;
  /** CSS class for each image */
  imageClassName?: string;
  /** Max height style */
  maxHeight?: string;
  /** Overlay element rendered on top of slides */
  overlay?: React.ReactNode;
}

export default function HeroBannerCarousel({
  images,
  storeName,
  optimizeWidth = 800,
  interval = 2000,
  className = "",
  imageClassName = "w-full h-auto object-cover",
  maxHeight,
  overlay,
}: HeroBannerCarouselProps) {
  if (images.length === 0) return null;

  if (images.length === 1) {
    return (
      <div className={`relative ${className}`}>
        <img
          src={optimizeImageUrl(images[0], optimizeWidth)}
          alt={`${storeName} hero banner`}
          className={imageClassName}
          style={maxHeight ? { maxHeight } : undefined}
          loading="eager"
          fetchPriority="high"
        />
        {overlay}
      </div>
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

function CarouselInner({
  images,
  storeName,
  optimizeWidth,
  interval,
  className,
  imageClassName,
  maxHeight,
  overlay,
}: Required<Pick<HeroBannerCarouselProps, "images" | "storeName" | "optimizeWidth" | "interval">> &
  Pick<HeroBannerCarouselProps, "className" | "imageClassName" | "maxHeight" | "overlay">) {
  const [current, setCurrent] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const len = images.length;

  const goTo = useCallback(
    (idx: number) => setCurrent((idx + len) % len),
    [len]
  );

  const next = useCallback(() => goTo(current + 1), [current, goTo]);
  const prev = useCallback(() => goTo(current - 1), [current, goTo]);

  // Auto-play
  useEffect(() => {
    intervalRef.current = setInterval(next, interval);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [next, interval]);

  const resetTimer = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(next, interval);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const diff = e.changedTouches[0].clientX - touchStart;
    if (Math.abs(diff) > 50) {
      if (diff < 0) next();
      else prev();
    }
    setTouchStart(null);
    resetTimer();
  };

  return (
    <div className={`relative overflow-hidden ${className || ""}`}>
      <div
        className="flex transition-transform duration-500 ease-out"
        style={{ transform: `translateX(-${current * 100}%)` }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {images.map((url, i) => (
          <div key={i} className="w-full flex-shrink-0">
            <img
              src={optimizeImageUrl(url, optimizeWidth)}
              alt={`${storeName} hero banner ${i + 1}`}
              className={imageClassName}
              style={maxHeight ? { maxHeight } : undefined}
              loading={i === 0 ? "eager" : "lazy"}
              fetchPriority={i === 0 ? "high" : undefined}
            />
          </div>
        ))}
      </div>

      {overlay}

      {/* Dots */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex gap-1.5">
        {images.map((_, i) => (
          <button
            key={i}
            onClick={() => {
              goTo(i);
              resetTimer();
            }}
            className={`h-2 rounded-full transition-all duration-300 ${
              i === current ? "w-5 bg-white" : "w-2 bg-white/50"
            }`}
            aria-label={`Go to slide ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
