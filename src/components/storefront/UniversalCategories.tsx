import { Tag, ChevronLeft, ChevronRight } from "lucide-react";
import SectionHeading from "@/components/storefront/SectionHeading";
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { storefrontPath } from "@/lib/subdomain";
import { optimizeImageUrl } from "@/lib/imageOptimize";
import { useState, useCallback, useRef, useEffect } from "react";

interface Category {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
}

interface Props {
  categories: Category[] | undefined;
  storeSlug: string;
  isLoading?: boolean;
  categoryStyle?: string;
}

function CircleSkeleton() {
  return (
    <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
      <Skeleton className="h-[72px] w-[72px] rounded-full sm:h-[88px] sm:w-[88px]" />
      <Skeleton className="h-3 w-14" />
    </div>
  );
}

function SquareCarouselSkeleton() {
  return (
    <div className="flex-shrink-0 w-20">
      <Skeleton className="h-20 w-20 rounded-xl" />
      <Skeleton className="h-3 w-16 mt-1.5 mx-auto" />
    </div>
  );
}

function GridSkeleton() {
  return (
    <div>
      <Skeleton className="w-full rounded-xl" style={{ aspectRatio: "1/1" }} />
      <Skeleton className="h-3 w-20 mt-1.5 mx-auto" />
    </div>
  );
}

function PillSkeleton() {
  return <Skeleton className="h-10 w-28 rounded-full flex-shrink-0" />;
}

function CategoryImage({ cat, size = 300, className = "h-full w-full object-cover" }: { cat: Category; size?: number; className?: string }) {
  if (cat.image_url) {
    return <img src={optimizeImageUrl(cat.image_url, size, 85)} alt={cat.name} className={className} loading="lazy" width={size} height={size} />;
  }
  return (
    <div className="flex h-full w-full items-center justify-center" style={{ backgroundColor: "var(--storefront-bg, hsl(var(--accent)))" }}>
      <Tag className="h-5 w-5 sm:h-6 sm:w-6" style={{ color: "var(--storefront-text, hsl(var(--muted-foreground)))", opacity: 0.5 }} />
    </div>
  );
}

/** Style 1: Small circles in horizontal carousel */
function CircleCarousel({ categories, storeSlug }: { categories: Category[]; storeSlug: string }) {
  return (
    <>
      {/* Mobile: horizontal scroll */}
      <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide md:hidden" style={{ scrollbarWidth: "none", msOverflowStyle: "none", WebkitOverflowScrolling: "touch" }}>
        {categories.map((cat) => (
          <Link key={cat.id} to={storefrontPath(storeSlug, `category/${cat.slug}`)} className="flex flex-col items-center gap-1 flex-shrink-0 transition-all">
            <div className="h-[72px] w-[72px] rounded-full border-2 overflow-hidden transition-all sm:h-[88px] sm:w-[88px] border-border bg-secondary/30" onMouseEnter={(e) => e.currentTarget.style.borderColor = "var(--storefront-primary, hsl(var(--primary)))"} onMouseLeave={(e) => e.currentTarget.style.borderColor = ""}>
              <CategoryImage cat={cat} size={300} className="h-full w-full object-cover scale-110" />
            </div>
            <span className="text-[10px] font-semibold tracking-wide text-center leading-tight max-w-[72px] truncate sm:max-w-[88px] sm:text-[11px]" style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }}>{cat.name}</span>
          </Link>
        ))}
      </div>
      {/* Desktop: centered grid with larger circles */}
      <div className="hidden md:flex flex-wrap justify-center gap-6 lg:gap-8">
        {categories.map((cat) => (
          <Link key={cat.id} to={storefrontPath(storeSlug, `category/${cat.slug}`)} className="flex flex-col items-center gap-2 transition-all">
            <div className="h-[120px] w-[120px] lg:h-[140px] lg:w-[140px] rounded-full border-2 overflow-hidden transition-all border-border bg-secondary/30 hover:shadow-lg" onMouseEnter={(e) => e.currentTarget.style.borderColor = "var(--storefront-primary, hsl(var(--primary)))"} onMouseLeave={(e) => e.currentTarget.style.borderColor = ""}>
              <CategoryImage cat={cat} size={300} className="h-full w-full object-cover scale-110" />
            </div>
            <span className="text-xs lg:text-sm font-semibold tracking-wide text-center leading-tight max-w-[140px] truncate" style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }}>{cat.name}</span>
          </Link>
        ))}
      </div>
    </>
  );
}

/** Style 2: Square small cards in horizontal carousel */
function SquareCarousel({ categories, storeSlug }: { categories: Category[]; storeSlug: string }) {
  return (
    <>
      <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide md:hidden" style={{ scrollbarWidth: "none", msOverflowStyle: "none", WebkitOverflowScrolling: "touch" }}>
        {categories.map((cat) => (
          <Link key={cat.id} to={storefrontPath(storeSlug, `category/${cat.slug}`)} className="flex-shrink-0 group">
            <div className="h-20 w-20 sm:h-[88px] sm:w-[88px] rounded-xl overflow-hidden border border-border transition-all group-hover:shadow-lg group-hover:border-transparent" style={{ aspectRatio: "1/1" }}>
              <CategoryImage cat={cat} size={300} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
            </div>
            <p className="mt-1.5 text-[10px] font-semibold text-center truncate max-w-20 sm:max-w-[88px]" style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }}>{cat.name}</p>
          </Link>
        ))}
      </div>
      <div className="hidden md:flex flex-wrap justify-center gap-5 lg:gap-7">
        {categories.map((cat) => (
          <Link key={cat.id} to={storefrontPath(storeSlug, `category/${cat.slug}`)} className="group">
            <div className="h-[120px] w-[120px] lg:h-[140px] lg:w-[140px] rounded-xl overflow-hidden border border-border transition-all group-hover:shadow-lg group-hover:border-transparent" style={{ aspectRatio: "1/1" }}>
              <CategoryImage cat={cat} size={400} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
            </div>
            <p className="mt-2 text-xs lg:text-sm font-semibold text-center truncate max-w-[140px]" style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }}>{cat.name}</p>
          </Link>
        ))}
      </div>
    </>
  );
}

/** Style 3: Modern square grid with overlay label */
function SquareGridModern({ categories, storeSlug }: { categories: Category[]; storeSlug: string }) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2.5 lg:gap-4">
      {categories.map((cat) => (
        <Link key={cat.id} to={storefrontPath(storeSlug, `category/${cat.slug}`)} className="group relative">
          <div className="w-full rounded-xl overflow-hidden transition-all group-hover:shadow-lg" style={{ aspectRatio: "1/1" }}>
            <CategoryImage cat={cat} size={400} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent rounded-xl" />
            <span className="absolute bottom-2 left-0 right-0 text-[10px] sm:text-[11px] font-bold text-white text-center truncate px-1.5 drop-shadow-md">{cat.name}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}

/** Style 4: Square cards in grid layout */
function SquareGrid({ categories, storeSlug }: { categories: Category[]; storeSlug: string }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 lg:gap-4">
      {categories.map((cat) => (
        <Link key={cat.id} to={storefrontPath(storeSlug, `category/${cat.slug}`)} className="group">
          <div className="w-full rounded-xl overflow-hidden border border-border transition-all group-hover:shadow-md" style={{ aspectRatio: "1/1" }}>
            <CategoryImage cat={cat} size={400} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
          </div>
          <p className="mt-1.5 text-xs font-semibold text-center truncate" style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }}>{cat.name}</p>
        </Link>
      ))}
    </div>
  );
}

/** Style 5: Pill / chip style */
function PillCarousel({ categories, storeSlug }: { categories: Category[]; storeSlug: string }) {
  return (
    <>
      <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-hide md:hidden" style={{ scrollbarWidth: "none", msOverflowStyle: "none", WebkitOverflowScrolling: "touch" }}>
        {categories.map((cat) => (
          <Link
            key={cat.id}
            to={storefrontPath(storeSlug, `category/${cat.slug}`)}
            className="flex-shrink-0 flex items-center gap-2 rounded-full border border-border px-1 pr-4 py-1 transition-all hover:shadow-md hover:border-transparent group"
            style={{ backgroundColor: "var(--storefront-bg, hsl(var(--background)))" }}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = "var(--storefront-primary, hsl(var(--primary)))"}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = ""}
          >
            <div className="h-8 w-8 rounded-full overflow-hidden flex-shrink-0">
              <CategoryImage cat={cat} size={64} className="h-full w-full object-cover" />
            </div>
            <span className="text-[11px] font-semibold whitespace-nowrap" style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }}>{cat.name}</span>
          </Link>
        ))}
      </div>
      <div className="hidden md:flex flex-wrap justify-center gap-3">
        {categories.map((cat) => (
          <Link
            key={cat.id}
            to={storefrontPath(storeSlug, `category/${cat.slug}`)}
            className="flex items-center gap-2.5 rounded-full border border-border px-2 pr-5 py-1.5 transition-all hover:shadow-md hover:border-transparent group"
            style={{ backgroundColor: "var(--storefront-bg, hsl(var(--background)))" }}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = "var(--storefront-primary, hsl(var(--primary)))"}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = ""}
          >
            <div className="h-10 w-10 rounded-full overflow-hidden flex-shrink-0">
              <CategoryImage cat={cat} size={80} className="h-full w-full object-cover" />
            </div>
            <span className="text-sm font-semibold whitespace-nowrap" style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }}>{cat.name}</span>
          </Link>
        ))}
      </div>
    </>
  );
}

/** Style 6: Reveal Grid — 2-up square cards with arrow navigation + slide-up animation */
function RevealGrid({ categories, storeSlug }: { categories: Category[]; storeSlug: string }) {
  const [page, setPage] = useState(0);
  const perPage = 2;
  const totalPages = Math.ceil(categories.length / perPage);
  const [animDir, setAnimDir] = useState<"next" | "prev">("next");
  const [animKey, setAnimKey] = useState(0);

  const goNext = useCallback(() => {
    setAnimDir("next");
    setPage((p) => (p + 1) % totalPages);
    setAnimKey((k) => k + 1);
  }, [totalPages]);

  const goPrev = useCallback(() => {
    setAnimDir("prev");
    setPage((p) => (p - 1 + totalPages) % totalPages);
    setAnimKey((k) => k + 1);
  }, [totalPages]);

  const visible = categories.slice(page * perPage, page * perPage + perPage);

  return (
    <div>
      <div key={animKey} className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 lg:gap-4">
        {visible.map((cat, idx) => (
          <Link
            key={cat.id}
            to={storefrontPath(storeSlug, `category/${cat.slug}`)}
            className="group relative overflow-hidden rounded-2xl"
            style={{
              aspectRatio: "1/1",
              animation: `revealSlideUp 0.45s cubic-bezier(0.22, 1, 0.36, 1) ${idx * 0.12}s both`,
            }}
          >
            <div className="h-full w-full overflow-hidden">
              <CategoryImage cat={cat} size={500} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4">
              <span className="text-sm sm:text-base font-bold text-white drop-shadow-lg">{cat.name}</span>
            </div>
          </Link>
        ))}
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-3">
          <button onClick={goPrev} className="h-9 w-9 rounded-full flex items-center justify-center transition-all active:scale-95" style={{ border: "1px solid color-mix(in srgb, var(--storefront-text, hsl(var(--border))) 15%, transparent)" }} aria-label="Previous">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex gap-1.5">
            {Array.from({ length: totalPages }).map((_, i) => (
              <div key={i} className="h-1.5 rounded-full transition-all duration-300" style={{ width: i === page ? 20 : 6, backgroundColor: i === page ? "var(--storefront-primary, hsl(var(--primary)))" : "var(--border)" }} />
            ))}
          </div>
          <button onClick={goNext} className="h-9 w-9 rounded-full flex items-center justify-center transition-all active:scale-95" style={{ border: "1px solid color-mix(in srgb, var(--storefront-text, hsl(var(--border))) 15%, transparent)" }} aria-label="Next">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
      <style>{`
        @keyframes revealSlideUp {
          from { opacity: 0; transform: translateY(40px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}

/** Style 8: Spotlight Carousel — one large center + peek sides */
function SpotlightCarousel({ categories, storeSlug }: { categories: Category[]; storeSlug: string }) {
  const [active, setActive] = useState(0);
  const [prev, setPrev] = useState<number | null>(null);
  const [direction, setDirection] = useState<'next' | 'prev'>('next');
  const len = categories.length;
  const transitionRef = useRef(false);

  const go = useCallback((to: number, dir: 'next' | 'prev') => {
    if (transitionRef.current || to === active) return;
    transitionRef.current = true;
    setDirection(dir);
    setPrev(active);
    setActive(to);
    setTimeout(() => { setPrev(null); transitionRef.current = false; }, 600);
  }, [active]);

  const goNext = useCallback(() => go((active + 1) % len, 'next'), [go, active, len]);
  const goPrev = useCallback(() => go((active - 1 + len) % len, 'prev'), [go, active, len]);

  const getIdx = (offset: number) => (active + offset + len) % len;

  // Auto-play
  useEffect(() => {
    if (len <= 1) return;
    const timer = setInterval(goNext, 4500);
    return () => clearInterval(timer);
  }, [goNext, len]);

  // Touch/swipe
  const touchStartX = useRef(0);
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) diff > 0 ? goNext() : goPrev();
  }, [goNext, goPrev]);

  if (len === 0) return null;

  const isTransitioning = prev !== null;

  return (
    <div className="relative" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <div className="flex items-center justify-center gap-2 sm:gap-3 overflow-hidden py-2" style={{ minHeight: 220 }}>
        {/* Left peek */}
        {len > 2 && (
          <div
            className="flex-shrink-0 w-[18%] sm:w-[15%] rounded-xl overflow-hidden cursor-pointer"
            style={{
              aspectRatio: "3/4",
              opacity: 0.45,
              transform: `scale(0.85) translateX(12px)`,
              filter: "blur(1.5px)",
              transition: "all 0.55s cubic-bezier(0.25, 1, 0.5, 1)",
            }}
            onClick={goPrev}
          >
            <CategoryImage cat={categories[getIdx(-1)]} size={300} className="h-full w-full object-cover" />
          </div>
        )}

        {/* Center spotlight with crossfade */}
        <div className="flex-shrink-0 w-[58%] sm:w-[50%] md:w-[40%] lg:max-w-[400px] relative rounded-2xl overflow-hidden shadow-2xl" style={{ aspectRatio: "3/4" }}>
          {/* Outgoing (prev) card */}
          {isTransitioning && prev !== null && (
            <div
              className="absolute inset-0 z-10"
              style={{
                animation: `spotlightFadeOut 0.55s cubic-bezier(0.25, 1, 0.5, 1) forwards`,
              }}
            >
              <CategoryImage cat={categories[prev]} size={600} className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-4 text-center">
                <span className="text-base sm:text-lg font-bold text-white drop-shadow-lg tracking-wide">{categories[prev].name}</span>
              </div>
            </div>
          )}

          {/* Incoming (active) card */}
          <Link
            to={storefrontPath(storeSlug, `category/${categories[active].slug}`)}
            className="block h-full w-full"
            style={{
              animation: isTransitioning
                ? `spotlightFadeIn 0.55s cubic-bezier(0.25, 1, 0.5, 1) forwards`
                : undefined,
            }}
          >
            <CategoryImage cat={categories[active]} size={600} className="h-full w-full object-cover transition-transform duration-700 hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
            <div
              className="absolute bottom-0 left-0 right-0 p-4 text-center"
              style={{
                animation: isTransitioning ? "spotlightTextRise 0.5s cubic-bezier(0.25, 1, 0.5, 1) 0.1s both" : undefined,
              }}
            >
              <span className="text-base sm:text-lg font-bold text-white drop-shadow-lg tracking-wide">{categories[active].name}</span>
              <div
                className="mt-1.5 mx-auto h-0.5 rounded-full"
                style={{
                  width: 32,
                  backgroundColor: "var(--storefront-primary, hsl(var(--primary)))",
                  opacity: 0.8,
                  animation: isTransitioning ? "spotlightLineGrow 0.5s cubic-bezier(0.25, 1, 0.5, 1) 0.2s both" : undefined,
                }}
              />
            </div>
          </Link>
        </div>

        {/* Right peek */}
        {len > 1 && (
          <div
            className="flex-shrink-0 w-[18%] sm:w-[15%] rounded-xl overflow-hidden cursor-pointer"
            style={{
              aspectRatio: "3/4",
              opacity: 0.45,
              transform: `scale(0.85) translateX(-12px)`,
              filter: "blur(1.5px)",
              transition: "all 0.55s cubic-bezier(0.25, 1, 0.5, 1)",
            }}
            onClick={goNext}
          >
            <CategoryImage cat={categories[getIdx(1)]} size={300} className="h-full w-full object-cover" />
          </div>
        )}
      </div>

      {len > 1 && (
        <div className="flex items-center justify-center gap-4 mt-3">
          <button onClick={goPrev} className="h-9 w-9 rounded-full border border-border flex items-center justify-center hover:bg-accent active:scale-90 transition-all duration-200" aria-label="Previous">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex gap-1.5 items-center">
            {categories.map((_, i) => (
              <div
                key={i}
                className="rounded-full cursor-pointer"
                onClick={() => go(i, i > active ? 'next' : 'prev')}
                style={{
                  width: i === active ? 20 : 6,
                  height: 6,
                  backgroundColor: i === active ? "var(--storefront-primary, hsl(var(--primary)))" : "var(--border)",
                  transform: i === active ? "scaleY(1)" : "scaleY(0.8)",
                  transition: "all 0.4s cubic-bezier(0.25, 1, 0.5, 1)",
                }}
              />
            ))}
          </div>
          <button onClick={goNext} className="h-9 w-9 rounded-full border border-border flex items-center justify-center hover:bg-accent active:scale-90 transition-all duration-200" aria-label="Next">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      <style>{`
        @keyframes spotlightFadeIn {
          from { opacity: 0; transform: scale(0.92); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes spotlightFadeOut {
          from { opacity: 1; transform: scale(1); }
          to { opacity: 0; transform: scale(1.04); }
        }
        @keyframes spotlightTextRise {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spotlightLineGrow {
          from { width: 0; opacity: 0; }
          to { width: 32px; opacity: 0.8; }
        }
      `}</style>
    </div>
  );
}

/** Style 11: Two-Row Circle Carousel — circles in 2 rows, both scroll together */
function TwoRowCircleCarousel({ categories, storeSlug }: { categories: Category[]; storeSlug: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(true);

  const updateArrows = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateArrows();
    el.addEventListener("scroll", updateArrows, { passive: true });
    return () => el.removeEventListener("scroll", updateArrows);
  }, [updateArrows]);

  const scroll = useCallback((dir: number) => {
    scrollRef.current?.scrollBy({ left: dir * 260, behavior: "smooth" });
  }, []);

  // Split categories into two rows
  const half = Math.ceil(categories.length / 2);
  const row1 = categories.slice(0, half);
  const row2 = categories.slice(half);

  // Build columns: each column has [row1[i], row2[i]]
  const columns: [Category, Category | undefined][] = [];
  const maxCols = Math.max(row1.length, row2.length);
  for (let i = 0; i < maxCols; i++) {
    columns.push([row1[i] || row2[i]!, i < row2.length ? row2[i] : undefined]);
  }

  return (
    <div className="relative group/carousel">
      {/* Left arrow */}
      {canLeft && (
        <button
          onClick={() => scroll(-1)}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full flex items-center justify-center shadow-md opacity-0 group-hover/carousel:opacity-100 transition-opacity"
          style={{ backgroundColor: "var(--storefront-bg, hsl(var(--background)))", border: "1px solid var(--border)" }}
          aria-label="Scroll left"
        >
          <ChevronLeft className="h-4 w-4" style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }} />
        </button>
      )}
      {/* Right arrow */}
      {canRight && (
        <button
          onClick={() => scroll(1)}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full flex items-center justify-center shadow-md opacity-0 group-hover/carousel:opacity-100 transition-opacity"
          style={{ backgroundColor: "var(--storefront-bg, hsl(var(--background)))", border: "1px solid var(--border)" }}
          aria-label="Scroll right"
        >
          <ChevronRight className="h-4 w-4" style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }} />
        </button>
      )}

      <div
        ref={scrollRef}
        className="overflow-x-auto scrollbar-hide"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none", WebkitOverflowScrolling: "touch" }}
      >
        <div className="flex gap-3 sm:gap-4 w-max">
          {columns.map((col, colIdx) => (
            <div key={colIdx} className="flex flex-col gap-3 sm:gap-4 flex-shrink-0">
              {col.map((cat, rowIdx) =>
                cat ? (
                  <Link
                    key={cat.id}
                    to={storefrontPath(storeSlug, `category/${cat.slug}`)}
                    className="flex flex-col items-center gap-1 transition-all"
                  >
                    <div
                      className="h-[68px] w-[68px] sm:h-[80px] sm:w-[80px] md:h-[100px] md:w-[100px] rounded-full border-2 overflow-hidden transition-all border-border bg-secondary/30"
                      onMouseEnter={(e) => e.currentTarget.style.borderColor = "var(--storefront-primary, hsl(var(--primary)))"}
                      onMouseLeave={(e) => e.currentTarget.style.borderColor = ""}
                    >
                      <CategoryImage cat={cat} size={300} className="h-full w-full object-cover scale-110" />
                    </div>
                    <span
                      className="text-[10px] sm:text-[11px] font-semibold tracking-wide text-center leading-tight max-w-[68px] sm:max-w-[80px] md:max-w-[100px] truncate"
                      style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }}
                    >
                      {cat.name}
                    </span>
                  </Link>
                ) : (
                  <div key={`empty-${rowIdx}`} className="h-[68px] w-[68px] sm:h-[80px] sm:w-[80px] md:h-[100px] md:w-[100px]" />
                )
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Style 10: Magazine Strip — landscape cards stacked vertically */
function MagazineStrip({ categories, storeSlug }: { categories: Category[]; storeSlug: string }) {
  return (
    <div className="flex flex-col gap-3 md:grid md:grid-cols-2 lg:gap-4">
      {categories.map((cat, idx) => (
        <Link
          key={cat.id}
          to={storefrontPath(storeSlug, `category/${cat.slug}`)}
          className="group flex overflow-hidden rounded-2xl border border-border transition-all hover:shadow-lg"
          style={{
            height: "clamp(100px, 20vw, 160px)",
            animation: `magazineSlideIn 0.4s ease-out ${idx * 0.08}s both`,
          }}
        >
          <div className="w-[55%] sm:w-[60%] overflow-hidden">
            <CategoryImage cat={cat} size={600} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
          </div>
          <div className="flex-1 flex flex-col justify-center px-4 sm:px-6" style={{ background: "linear-gradient(135deg, var(--storefront-bg, hsl(var(--background))), var(--storefront-bg, hsl(var(--background))))" }}>
            <span className="text-sm sm:text-base font-bold leading-tight" style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }}>{cat.name}</span>
            <span className="mt-1.5 text-[10px] sm:text-xs font-medium opacity-60" style={{ color: "var(--storefront-primary, hsl(var(--primary)))" }}>Explore →</span>
          </div>
        </Link>
      ))}
      <style>{`
        @keyframes magazineSlideIn {
          from { opacity: 0; transform: translateX(-20px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}

export default function UniversalCategories({ categories, storeSlug, isLoading, categoryStyle = "style-1" }: Props) {
  if (!isLoading && (!categories || categories.length === 0)) return null;

  const isCarousel = categoryStyle === "style-1" || categoryStyle === "style-2" || categoryStyle === "style-5" || categoryStyle === "style-11";
  const isCompact = isCarousel || categoryStyle === "style-9";

  const gridMinHeight = (categoryStyle === "style-3" || categoryStyle === "style-4") ? 280
    : (categoryStyle === "style-6" || categoryStyle === "style-7" || categoryStyle === "style-10") ? 220
    : (categoryStyle === "style-8") ? 240
    : (categoryStyle === "style-11") ? 220
    : 104;

  return (
    <div className="backdrop-blur-md" style={{ minHeight: gridMinHeight, contain: "layout style", backgroundColor: "var(--storefront-bg, hsl(var(--background)))" }}>
      <div className="mx-auto max-w-7xl px-4 py-5 lg:py-8">
        <SectionHeading title="Shop by Category" />
        {isLoading ? (
          isCarousel ? (
            <div className="flex gap-4 overflow-hidden">
              {Array.from({ length: 6 }).map((_, i) =>
                categoryStyle === "style-2" ? <SquareCarouselSkeleton key={i} /> : categoryStyle === "style-5" ? <PillSkeleton key={i} /> : <CircleSkeleton key={i} />
              )}
            </div>
          ) : (
            <div className={`grid gap-2.5 ${categoryStyle === "style-3" ? "grid-cols-3 sm:grid-cols-4 md:grid-cols-5" : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4"}`}>
              {Array.from({ length: categoryStyle === "style-3" ? 6 : 4 }).map((_, i) => <GridSkeleton key={i} />)}
            </div>
          )
        ) : (
          <>
            {categoryStyle === "style-1" && <CircleCarousel categories={categories!} storeSlug={storeSlug} />}
            {categoryStyle === "style-2" && <SquareCarousel categories={categories!} storeSlug={storeSlug} />}
            {categoryStyle === "style-3" && <SquareGridModern categories={categories!} storeSlug={storeSlug} />}
            {categoryStyle === "style-4" && <SquareGrid categories={categories!} storeSlug={storeSlug} />}
            {categoryStyle === "style-5" && <PillCarousel categories={categories!} storeSlug={storeSlug} />}
            {categoryStyle === "style-6" && <RevealGrid categories={categories!} storeSlug={storeSlug} />}
            {categoryStyle === "style-8" && <SpotlightCarousel categories={categories!} storeSlug={storeSlug} />}
            {categoryStyle === "style-10" && <MagazineStrip categories={categories!} storeSlug={storeSlug} />}
            {categoryStyle === "style-11" && <TwoRowCircleCarousel categories={categories!} storeSlug={storeSlug} />}
          </>
        )}
      </div>
    </div>
  );
}