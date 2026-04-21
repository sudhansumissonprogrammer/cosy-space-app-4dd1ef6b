/**
 * MobileHeroCarousel — auto-rotating mobile hero with dot indicators.
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

  // Auto-advance
  useEffect(() => {
    if (images.length <= 1) return;
    const id = setInterval(() => {
      if (userInteractingRef.current) return;
      setIndex((i) => (i + 1) % images.length);
    }, intervalMs);
    return () => clearInterval(id);
  }, [images.length, intervalMs]);

  // Scroll to current index
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const slide = el.children[index] as HTMLElement | undefined;
    if (slide) el.scrollTo({ left: slide.offsetLeft, behavior: "smooth" });
  }, [index]);

  // Sync index when user manually scrolls
  const onScroll = () => {
    const el = trackRef.current;
    if (!el) return;
    userInteractingRef.current = true;
    const w = el.clientWidth;
    const i = Math.round(el.scrollLeft / w);
    if (i !== index) setIndex(i);
    window.clearTimeout((onScroll as any)._t);
    (onScroll as any)._t = window.setTimeout(() => {
      userInteractingRef.current = false;
    }, 1500);
  };

  if (images.length === 0) return null;

  return (
    <div className="md:hidden -mx-1">
      <div
        ref={trackRef}
        onScroll={onScroll}
        className="flex overflow-x-auto scrollbar-hide snap-x snap-mandatory px-1"
      >
        {images.map((url, i) => (
          <Link
            key={`${url}-${i}`}
            to={linkTo}
            className="block flex-shrink-0 w-full snap-center"
          >
            <div className="w-full rounded-2xl overflow-hidden shadow-sm" style={{ aspectRatio: "16 / 9" }}>
              <img
                src={optimizeImageUrl(url, 900, 85)}
                alt={`${storeName} hero ${i + 1}`}
                className="w-full h-full object-cover block"
                loading={i === 0 ? "eager" : "lazy"}
                fetchPriority={i === 0 ? "high" : "low"}
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
