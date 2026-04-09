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
    <div className="flex h-full w-full items-center justify-center bg-accent">
      <Tag className="h-5 w-5 text-muted-foreground sm:h-6 sm:w-6" />
    </div>
  );
}

/** Style 1: Small circles in horizontal carousel */
function CircleCarousel({ categories, storeSlug }: { categories: Category[]; storeSlug: string }) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide" style={{ scrollbarWidth: "none", msOverflowStyle: "none", WebkitOverflowScrolling: "touch" }}>
      {categories.map((cat) => (
        <Link key={cat.id} to={storefrontPath(storeSlug, `category/${cat.slug}`)} className="flex flex-col items-center gap-1 flex-shrink-0 transition-all">
          <div className="h-[72px] w-[72px] rounded-full border-2 overflow-hidden transition-all sm:h-[88px] sm:w-[88px] border-border bg-secondary/30" onMouseEnter={(e) => e.currentTarget.style.borderColor = "var(--storefront-primary, hsl(var(--primary)))"} onMouseLeave={(e) => e.currentTarget.style.borderColor = ""}>
            <CategoryImage cat={cat} size={300} className="h-full w-full object-cover scale-110" />
          </div>
          <span className="text-[10px] font-semibold tracking-wide text-foreground text-center leading-tight max-w-[72px] truncate sm:max-w-[88px] sm:text-[11px]">{cat.name}</span>
        </Link>
      ))}
    </div>
  );
}

/** Style 2: Square small cards in horizontal carousel */
function SquareCarousel({ categories, storeSlug }: { categories: Category[]; storeSlug: string }) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide" style={{ scrollbarWidth: "none", msOverflowStyle: "none", WebkitOverflowScrolling: "touch" }}>
      {categories.map((cat) => (
        <Link key={cat.id} to={storefrontPath(storeSlug, `category/${cat.slug}`)} className="flex-shrink-0 group">
          <div className="h-20 w-20 sm:h-[88px] sm:w-[88px] rounded-xl overflow-hidden border border-border transition-all group-hover:shadow-lg group-hover:border-transparent" style={{ aspectRatio: "1/1" }}>
            <CategoryImage cat={cat} size={300} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
          </div>
          <p className="mt-1.5 text-[10px] font-semibold text-foreground text-center truncate max-w-20 sm:max-w-[88px]">{cat.name}</p>
        </Link>
      ))}
    </div>
  );
}

/** Style 3: Modern square grid with overlay label */
function SquareGridModern({ categories, storeSlug }: { categories: Category[]; storeSlug: string }) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2.5">
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
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {categories.map((cat) => (
        <Link key={cat.id} to={storefrontPath(storeSlug, `category/${cat.slug}`)} className="group">
          <div className="w-full rounded-xl overflow-hidden border border-border transition-all group-hover:shadow-md" style={{ aspectRatio: "1/1" }}>
            <CategoryImage cat={cat} size={400} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
          </div>
          <p className="mt-1.5 text-xs font-semibold text-foreground text-center truncate">{cat.name}</p>
        </Link>
      ))}
    </div>
  );
}

/** Style 5: Pill / chip style */
function PillCarousel({ categories, storeSlug }: { categories: Category[]; storeSlug: string }) {
  return (
    <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-hide" style={{ scrollbarWidth: "none", msOverflowStyle: "none", WebkitOverflowScrolling: "touch" }}>
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
          <span className="text-[11px] font-semibold text-foreground whitespace-nowrap">{cat.name}</span>
        </Link>
      ))}
    </div>
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
      <div key={animKey} className="grid grid-cols-2 gap-3">
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
          <button onClick={goPrev} className="h-9 w-9 rounded-full border border-border flex items-center justify-center transition-all hover:bg-accent active:scale-95" aria-label="Previous">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex gap-1.5">
            {Array.from({ length: totalPages }).map((_, i) => (
              <div key={i} className="h-1.5 rounded-full transition-all duration-300" style={{ width: i === page ? 20 : 6, backgroundColor: i === page ? "var(--storefront-primary, hsl(var(--primary)))" : "var(--border)" }} />
            ))}
          </div>
          <button onClick={goNext} className="h-9 w-9 rounded-full border border-border flex items-center justify-center transition-all hover:bg-accent active:scale-95" aria-label="Next">
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

/** Style 7: Pinterest Masonry — alternating tall/short cards with staggered entry */
function MasonryGrid({ categories, storeSlug }: { categories: Category[]; storeSlug: string }) {
  return (
    <div className="columns-2 sm:columns-3 gap-2.5 space-y-2.5">
      {categories.map((cat, idx) => {
        const isTall = idx % 3 === 0;
        return (
          <Link
            key={cat.id}
            to={storefrontPath(storeSlug, `category/${cat.slug}`)}
            className="group relative block break-inside-avoid overflow-hidden rounded-2xl"
            style={{
              aspectRatio: isTall ? "3/4" : "4/3",
              animation: `masonryFadeIn 0.5s ease-out ${idx * 0.08}s both`,
            }}
          >
            <CategoryImage cat={cat} size={500} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-3">
              <div className="backdrop-blur-md bg-white/15 rounded-lg px-3 py-1.5 inline-block">
                <span className="text-xs sm:text-sm font-bold text-white drop-shadow-md">{cat.name}</span>
              </div>
            </div>
          </Link>
        );
      })}
      <style>{`
        @keyframes masonryFadeIn {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

/** Style 8: Spotlight Carousel — one large center + peek sides */
function SpotlightCarousel({ categories, storeSlug }: { categories: Category[]; storeSlug: string }) {
  const [active, setActive] = useState(0);
  const len = categories.length;

  const goNext = useCallback(() => setActive((a) => (a + 1) % len), [len]);
  const goPrev = useCallback(() => setActive((a) => (a - 1 + len) % len), [len]);

  const getIdx = (offset: number) => (active + offset + len) % len;

  if (len === 0) return null;

  return (
    <div className="relative">
      <div className="flex items-center justify-center gap-2 sm:gap-3 overflow-hidden py-2" style={{ minHeight: 200 }}>
        {/* Left peek */}
        {len > 2 && (
          <Link
            to={storefrontPath(storeSlug, `category/${categories[getIdx(-1)].slug}`)}
            className="flex-shrink-0 w-[18%] sm:w-[15%] rounded-xl overflow-hidden opacity-50 scale-90 transition-all duration-400"
            style={{ aspectRatio: "3/4" }}
          >
            <CategoryImage cat={categories[getIdx(-1)]} size={300} className="h-full w-full object-cover" />
          </Link>
        )}
        {/* Center spotlight */}
        <Link
          to={storefrontPath(storeSlug, `category/${categories[active].slug}`)}
          className="flex-shrink-0 w-[58%] sm:w-[50%] relative rounded-2xl overflow-hidden shadow-2xl transition-all duration-400"
          style={{ aspectRatio: "3/4", transform: "scale(1.02)" }}
        >
          <CategoryImage cat={categories[active]} size={600} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-4 text-center">
            <span className="text-base sm:text-lg font-bold text-white drop-shadow-lg">{categories[active].name}</span>
          </div>
        </Link>
        {/* Right peek */}
        {len > 1 && (
          <Link
            to={storefrontPath(storeSlug, `category/${categories[getIdx(1)].slug}`)}
            className="flex-shrink-0 w-[18%] sm:w-[15%] rounded-xl overflow-hidden opacity-50 scale-90 transition-all duration-400"
            style={{ aspectRatio: "3/4" }}
          >
            <CategoryImage cat={categories[getIdx(1)]} size={300} className="h-full w-full object-cover" />
          </Link>
        )}
      </div>
      {len > 1 && (
        <div className="flex items-center justify-center gap-4 mt-2">
          <button onClick={goPrev} className="h-8 w-8 rounded-full border border-border flex items-center justify-center hover:bg-accent active:scale-95 transition-all" aria-label="Previous">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex gap-1.5">
            {categories.map((_, i) => (
              <div key={i} className="h-1.5 rounded-full transition-all duration-300 cursor-pointer" onClick={() => setActive(i)} style={{ width: i === active ? 18 : 6, backgroundColor: i === active ? "var(--storefront-primary, hsl(var(--primary)))" : "var(--border)" }} />
            ))}
          </div>
          <button onClick={goNext} className="h-8 w-8 rounded-full border border-border flex items-center justify-center hover:bg-accent active:scale-95 transition-all" aria-label="Next">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

/** Style 9: Floating Bubble Grid — honeycomb-like with floating animation */
function FloatingBubbleGrid({ categories, storeSlug }: { categories: Category[]; storeSlug: string }) {
  return (
    <div className="flex flex-wrap justify-center gap-3 sm:gap-4 py-2">
      {categories.map((cat, idx) => {
        const offset = idx % 2 === 0 ? "translateY(-6px)" : "translateY(6px)";
        return (
          <Link
            key={cat.id}
            to={storefrontPath(storeSlug, `category/${cat.slug}`)}
            className="flex flex-col items-center gap-1.5 group"
            style={{ transform: offset }}
          >
            <div
              className="rounded-full overflow-hidden border-2 border-border shadow-lg transition-all duration-300 group-hover:shadow-xl group-hover:scale-110"
              style={{
                width: "clamp(72px, 18vw, 100px)",
                height: "clamp(72px, 18vw, 100px)",
                animation: `bubbleFloat 3s ease-in-out ${idx * 0.4}s infinite alternate`,
              }}
            >
              <CategoryImage cat={cat} size={200} className="h-full w-full object-cover" />
            </div>
            <span className="text-[10px] sm:text-[11px] font-semibold text-foreground text-center max-w-[80px] truncate">{cat.name}</span>
          </Link>
        );
      })}
      <style>{`
        @keyframes bubbleFloat {
          0% { transform: translateY(0); }
          100% { transform: translateY(-8px); }
        }
      `}</style>
    </div>
  );
}

/** Style 10: Magazine Strip — landscape cards stacked vertically */
function MagazineStrip({ categories, storeSlug }: { categories: Category[]; storeSlug: string }) {
  return (
    <div className="flex flex-col gap-3">
      {categories.map((cat, idx) => (
        <Link
          key={cat.id}
          to={storefrontPath(storeSlug, `category/${cat.slug}`)}
          className="group flex overflow-hidden rounded-2xl border border-border transition-all hover:shadow-lg"
          style={{
            height: "clamp(100px, 20vw, 140px)",
            animation: `magazineSlideIn 0.4s ease-out ${idx * 0.08}s both`,
          }}
        >
          <div className="w-[55%] sm:w-[60%] overflow-hidden">
            <CategoryImage cat={cat} size={600} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
          </div>
          <div className="flex-1 flex flex-col justify-center px-4 sm:px-6" style={{ background: "linear-gradient(135deg, var(--storefront-bg, hsl(var(--background))), var(--storefront-bg, hsl(var(--background))))" }}>
            <span className="text-sm sm:text-base font-bold text-foreground leading-tight">{cat.name}</span>
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

/** Style 11: Tab + Preview — tabs on top, large preview below */
function TabPreview({ categories, storeSlug }: { categories: Category[]; storeSlug: string }) {
  const [selected, setSelected] = useState(0);
  const [fadeKey, setFadeKey] = useState(0);

  const handleSelect = useCallback((idx: number) => {
    setSelected(idx);
    setFadeKey((k) => k + 1);
  }, []);

  const cat = categories[selected];
  if (!cat) return null;

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-hide" style={{ scrollbarWidth: "none" }}>
        {categories.map((c, i) => (
          <button
            key={c.id}
            onClick={() => handleSelect(i)}
            className="flex-shrink-0 px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all whitespace-nowrap"
            style={{
              backgroundColor: i === selected ? "var(--storefront-primary, hsl(var(--primary)))" : "transparent",
              color: i === selected ? "#fff" : "var(--foreground)",
              border: i === selected ? "none" : "1px solid var(--border)",
            }}
          >
            {c.name}
          </button>
        ))}
      </div>
      {/* Preview */}
      <Link
        key={fadeKey}
        to={storefrontPath(storeSlug, `category/${cat.slug}`)}
        className="block relative mt-2 rounded-2xl overflow-hidden group"
        style={{ aspectRatio: "16/9", animation: "tabPreviewFade 0.35s ease-out" }}
      >
        <CategoryImage cat={cat} size={800} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 flex items-end justify-between">
          <span className="text-lg sm:text-xl font-bold text-white drop-shadow-lg">{cat.name}</span>
          <span className="px-4 py-2 rounded-full text-xs sm:text-sm font-bold text-white transition-all" style={{ backgroundColor: "var(--storefront-primary, hsl(var(--primary)))" }}>
            Shop Now
          </span>
        </div>
      </Link>
      <style>{`
        @keyframes tabPreviewFade {
          from { opacity: 0; transform: scale(0.98); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

export default function UniversalCategories({ categories, storeSlug, isLoading, categoryStyle = "style-1" }: Props) {
  if (!isLoading && (!categories || categories.length === 0)) return null;

  const isCarousel = categoryStyle === "style-1" || categoryStyle === "style-2" || categoryStyle === "style-5";
  const isCompact = isCarousel || categoryStyle === "style-9";

  const gridMinHeight = (categoryStyle === "style-3" || categoryStyle === "style-4") ? 280
    : (categoryStyle === "style-6" || categoryStyle === "style-7" || categoryStyle === "style-10" || categoryStyle === "style-11") ? 220
    : (categoryStyle === "style-8") ? 240
    : 104;

  return (
    <div className="backdrop-blur-md" style={{ minHeight: gridMinHeight, contain: "layout style", backgroundColor: "var(--storefront-bg, hsl(var(--background)))" }}>
      <div className="mx-auto max-w-6xl px-4 py-5">
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
            {categoryStyle === "style-7" && <MasonryGrid categories={categories!} storeSlug={storeSlug} />}
            {categoryStyle === "style-8" && <SpotlightCarousel categories={categories!} storeSlug={storeSlug} />}
            {categoryStyle === "style-9" && <FloatingBubbleGrid categories={categories!} storeSlug={storeSlug} />}
            {categoryStyle === "style-10" && <MagazineStrip categories={categories!} storeSlug={storeSlug} />}
            {categoryStyle === "style-11" && <TabPreview categories={categories!} storeSlug={storeSlug} />}
          </>
        )}
      </div>
    </div>
  );
}