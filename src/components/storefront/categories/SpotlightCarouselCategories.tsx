import { useState, useCallback, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, Tag } from "lucide-react";
import { storefrontPath } from "@/lib/subdomain";
import { optimizeImageUrl } from "@/lib/imageOptimize";

interface Category { id: string; name: string; slug: string; image_url: string | null; }

function CategoryImage({ cat, size = 600, className = "h-full w-full object-cover" }: { cat: Category; size?: number; className?: string }) {
  if (cat.image_url) return <img src={optimizeImageUrl(cat.image_url, size, 85)} alt={cat.name} className={className} loading="lazy" width={size} height={size} />;
  return (
    <div className="flex h-full w-full items-center justify-center" style={{ backgroundColor: "var(--storefront-bg, hsl(var(--accent)))" }}>
      <Tag className="h-5 w-5" style={{ color: "var(--storefront-text, hsl(var(--muted-foreground)))", opacity: 0.5 }} />
    </div>
  );
}

export default function SpotlightCarouselCategories({ categories, storeSlug }: { categories: Category[]; storeSlug: string }) {
  const [active, setActive] = useState(0);
  const [prev, setPrev] = useState<number | null>(null);
  const len = categories.length;
  const transitionRef = useRef(false);

  const go = useCallback((to: number) => {
    if (transitionRef.current || to === active) return;
    transitionRef.current = true;
    setPrev(active);
    setActive(to);
    setTimeout(() => { setPrev(null); transitionRef.current = false; }, 600);
  }, [active]);

  const goNext = useCallback(() => go((active + 1) % len), [go, active, len]);
  const goPrev = useCallback(() => go((active - 1 + len) % len), [go, active, len]);
  const getIdx = (offset: number) => (active + offset + len) % len;

  useEffect(() => {
    if (len <= 1) return;
    const timer = setInterval(goNext, 4500);
    return () => clearInterval(timer);
  }, [goNext, len]);

  const touchStartX = useRef(0);
  const handleTouchStart = useCallback((e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; }, []);
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) diff > 0 ? goNext() : goPrev();
  }, [goNext, goPrev]);

  if (len === 0) return null;
  const isTransitioning = prev !== null;

  return (
    <div className="relative" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <div className="flex items-center justify-center gap-2 sm:gap-3 overflow-hidden py-2" style={{ minHeight: 220 }}>
        {len > 2 && (
          <div className="flex-shrink-0 w-[18%] sm:w-[15%] rounded-xl overflow-hidden cursor-pointer" style={{ aspectRatio: "3/4", opacity: 0.45, transform: `scale(0.85) translateX(12px)`, filter: "blur(1.5px)", transition: "all 0.55s cubic-bezier(0.25, 1, 0.5, 1)" }} onClick={goPrev}>
            <CategoryImage cat={categories[getIdx(-1)]} size={300} className="h-full w-full object-cover" />
          </div>
        )}
        <div className="flex-shrink-0 w-[58%] sm:w-[50%] md:w-[40%] lg:max-w-[400px] relative rounded-2xl overflow-hidden shadow-2xl" style={{ aspectRatio: "3/4" }}>
          {isTransitioning && prev !== null && (
            <div className="absolute inset-0 z-10" style={{ animation: `spotlightFadeOut 0.55s cubic-bezier(0.25, 1, 0.5, 1) forwards` }}>
              <CategoryImage cat={categories[prev]} size={600} className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-4 text-center">
                <span className="text-base sm:text-lg font-bold text-white drop-shadow-lg tracking-wide">{categories[prev].name}</span>
              </div>
            </div>
          )}
          <Link to={storefrontPath(storeSlug, `category/${categories[active].slug}`)} className="block h-full w-full" style={{ animation: isTransitioning ? `spotlightFadeIn 0.55s cubic-bezier(0.25, 1, 0.5, 1) forwards` : undefined }}>
            <CategoryImage cat={categories[active]} size={600} className="h-full w-full object-cover transition-transform duration-700 hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-4 text-center">
              <span className="text-base sm:text-lg font-bold text-white drop-shadow-lg tracking-wide" style={{ animation: isTransitioning ? `spotlightTextRise 0.5s cubic-bezier(0.25, 1, 0.5, 1) 0.15s both` : undefined }}>{categories[active].name}</span>
              <div className="mx-auto mt-2 h-[2px] rounded-full" style={{ width: 32, backgroundColor: "var(--storefront-primary, hsl(var(--primary)))", opacity: 0.8, animation: isTransitioning ? "spotlightLineGrow 0.5s cubic-bezier(0.25, 1, 0.5, 1) 0.2s both" : undefined }} />
            </div>
          </Link>
        </div>
        {len > 1 && (
          <div className="flex-shrink-0 w-[18%] sm:w-[15%] rounded-xl overflow-hidden cursor-pointer" style={{ aspectRatio: "3/4", opacity: 0.45, transform: `scale(0.85) translateX(-12px)`, filter: "blur(1.5px)", transition: "all 0.55s cubic-bezier(0.25, 1, 0.5, 1)" }} onClick={goNext}>
            <CategoryImage cat={categories[getIdx(1)]} size={300} className="h-full w-full object-cover" />
          </div>
        )}
      </div>
      {len > 1 && (
        <div className="flex items-center justify-center gap-4 mt-3">
          <button onClick={goPrev} className="h-9 w-9 rounded-full border border-border flex items-center justify-center hover:bg-accent active:scale-90 transition-all duration-200" aria-label="Previous"><ChevronLeft className="h-4 w-4" /></button>
          <div className="flex gap-1.5 items-center">
            {categories.map((_, i) => (
              <div key={i} className="rounded-full cursor-pointer" onClick={() => go(i)} style={{ width: i === active ? 20 : 6, height: 6, backgroundColor: i === active ? "var(--storefront-primary, hsl(var(--primary)))" : "var(--border)", transform: i === active ? "scaleY(1)" : "scaleY(0.8)", transition: "all 0.4s cubic-bezier(0.25, 1, 0.5, 1)" }} />
            ))}
          </div>
          <button onClick={goNext} className="h-9 w-9 rounded-full border border-border flex items-center justify-center hover:bg-accent active:scale-90 transition-all duration-200" aria-label="Next"><ChevronRight className="h-4 w-4" /></button>
        </div>
      )}
      <style>{`
        @keyframes spotlightFadeIn { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: scale(1); } }
        @keyframes spotlightFadeOut { from { opacity: 1; transform: scale(1); } to { opacity: 0; transform: scale(1.04); } }
        @keyframes spotlightTextRise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spotlightLineGrow { from { width: 0; opacity: 0; } to { width: 32px; opacity: 0.8; } }
      `}</style>
    </div>
  );
}
