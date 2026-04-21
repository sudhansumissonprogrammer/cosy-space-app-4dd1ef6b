/**
 * MobileHeroCarousel — auto-rotating hero with dot indicators.
 * - Mobile: 1 slide per view (full width).
 * - Desktop: shows ~1.5 slides with side peeks of adjacent banners (Blinkit/Zepto style).
 * Used by Theme 19 & 20 home pages.
 */
import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { optimizeImageUrl } from "@/lib/imageOptimize";

interface Props {
  images: string[];
  storeName: string;
  linkTo: string;
  intervalMs?: number;
}

export default function MobileHeroCarousel({ images, storeName, linkTo, intervalMs = 4000 }: Props) {
  const [index, setIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const userInteractingRef = useRef(false);
  const programmaticScrollRef = useRef(false);

  // Auto-advance
  useEffect(() => {
    if (images.length <= 1) return;
    const id = setInterval(() => {
      if (userInteractingRef.current) return;
      setIndex((i) => (i + 1) % images.length);
    }, intervalMs);
    return () => clearInterval(id);
  }, [images.length, intervalMs]);

  // Scroll to current index (programmatic — don't treat as user interaction)
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const slide = el.children[index] as HTMLElement | undefined;
    if (!slide) return;
    programmaticScrollRef.current = true;
    // Center the active slide on desktop (because slides are < 100% width).
    const target = slide.offsetLeft - (el.clientWidth - slide.clientWidth) / 2;
    el.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
    const t = window.setTimeout(() => {
      programmaticScrollRef.current = false;
    }, 700);
    return () => window.clearTimeout(t);
  }, [index]);

  const markInteracting = () => {
    userInteractingRef.current = true;
    window.clearTimeout((markInteracting as any)._t);
    (markInteracting as any)._t = window.setTimeout(() => {
      userInteractingRef.current = false;
    }, 2000);
  };

  // Sync index when user manually scrolls horizontally
  const onScroll = () => {
    const el = trackRef.current;
    if (!el) return;
    if (programmaticScrollRef.current) return;
    const slide = el.children[0] as HTMLElement | undefined;
    if (!slide) return;
    const slideW = slide.clientWidth + 12; // approx gap
    if (slideW === 0) return;
    const center = el.scrollLeft + el.clientWidth / 2;
    const i = Math.max(0, Math.min(images.length - 1, Math.round((center - slide.clientWidth / 2) / slideW)));
    if (i !== index) setIndex(i);
  };

  if (images.length === 0) return null;

  return (
    <div className="-mx-1">
      <div
        ref={trackRef}
        onScroll={onScroll}
        onTouchStart={markInteracting}
        onPointerDown={markInteracting}
        className="flex overflow-x-auto scrollbar-hide snap-x snap-mandatory px-1 gap-2 md:gap-3"
        style={{ touchAction: "pan-x pan-y", overscrollBehaviorX: "contain", WebkitOverflowScrolling: "touch" }}
      >
        {images.map((url, i) => (
          <Link
            key={`${url}-${i}`}
            to={linkTo}
            draggable={false}
            className="block flex-shrink-0 snap-center select-none w-full md:w-[48%] lg:w-[40%] xl:w-[36%]"
          >
            <div className="w-full rounded-2xl overflow-hidden shadow-sm bg-muted" style={{ aspectRatio: "16 / 9" }}>
              <img
                src={optimizeImageUrl(url, 1400, 85)}
                alt={`${storeName} hero ${i + 1}`}
                className="w-full h-full object-cover block pointer-events-none"
                loading={i === 0 ? "eager" : "lazy"}
                fetchPriority={i === 0 ? "high" : "low"}
                draggable={false}
              />
            </div>
          </Link>
        ))}
      </div>
      {images.length > 1 && (
        <div className="mt-2 flex items-center justify-center gap-1.5">
          {images.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Go to slide ${i + 1}`}
              className="h-1.5 rounded-full transition-all"
              style={{
                width: i === index ? 18 : 6,
                backgroundColor: i === index ? "#111827" : "#d1d5db",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
