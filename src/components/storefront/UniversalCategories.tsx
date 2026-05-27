import { Tag } from "lucide-react";
import SectionHeading from "@/components/storefront/SectionHeading";
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { storefrontPath } from "@/lib/subdomain";
import { optimizeImageUrl } from "@/lib/imageOptimize";
import { lazy, Suspense } from "react";

// Heavy category variants: lazy-loaded so a store using style-1 (default)
// never downloads Reveal/Spotlight/Magazine/TwoRow code (~12KB saved).
const RevealGridCategories = lazy(() => import("./categories/RevealGridCategories"));
const SpotlightCarouselCategories = lazy(() => import("./categories/SpotlightCarouselCategories"));
const MagazineStripCategories = lazy(() => import("./categories/MagazineStripCategories"));
const TwoRowCircleCarouselCategories = lazy(() => import("./categories/TwoRowCircleCarouselCategories"));

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