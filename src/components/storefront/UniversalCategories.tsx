import { Tag } from "lucide-react";
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { storefrontPath } from "@/lib/subdomain";

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
      <Skeleton className="h-16 w-16 rounded-full sm:h-20 sm:w-20" />
      <Skeleton className="h-3 w-14" />
    </div>
  );
}

function RectSkeleton() {
  return (
    <div className="flex-shrink-0 w-32">
      <Skeleton className="h-20 w-full rounded-lg" />
      <Skeleton className="h-3 w-20 mt-1.5 mx-auto" />
    </div>
  );
}

function GridSkeleton() {
  return (
    <div>
      <Skeleton className="w-full rounded-lg" style={{ aspectRatio: "4/3" }} />
      <Skeleton className="h-3 w-20 mt-1.5 mx-auto" />
    </div>
  );
}

/** Style 1: Small circles in horizontal carousel */
function CircleCarousel({ categories, storeSlug }: { categories: Category[]; storeSlug: string }) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-1 scrollbar-hide" style={{ scrollbarWidth: "none", msOverflowStyle: "none", WebkitOverflowScrolling: "touch" }}>
      {categories.map((cat) => (
        <Link key={cat.id} to={storefrontPath(storeSlug, `category/${cat.slug}`)} className="flex flex-col items-center gap-1.5 flex-shrink-0 transition-all">
          <div className="h-16 w-16 rounded-full border-2 overflow-hidden transition-all sm:h-20 sm:w-20 border-border" onMouseEnter={(e) => e.currentTarget.style.borderColor = "var(--storefront-primary, hsl(var(--primary)))"} onMouseLeave={(e) => e.currentTarget.style.borderColor = ""}>
            {cat.image_url ? (
              <img src={cat.image_url} alt={cat.name} className="h-full w-full object-cover" loading="lazy" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-accent"><Tag className="h-5 w-5 text-muted-foreground sm:h-6 sm:w-6" /></div>
            )}
          </div>
          <span className="text-[11px] font-semibold tracking-wide text-foreground text-center leading-tight max-w-[72px] truncate">{cat.name}</span>
        </Link>
      ))}
    </div>
  );
}

/** Style 2: Rectangle cards in horizontal carousel */
function RectCarousel({ categories, storeSlug }: { categories: Category[]; storeSlug: string }) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide" style={{ scrollbarWidth: "none", msOverflowStyle: "none", WebkitOverflowScrolling: "touch" }}>
      {categories.map((cat) => (
        <Link key={cat.id} to={storefrontPath(storeSlug, `category/${cat.slug}`)} className="flex-shrink-0 w-32 sm:w-36 group">
          <div className="h-20 sm:h-24 w-full rounded-xl overflow-hidden border border-border transition-all group-hover:shadow-md">
            {cat.image_url ? (
              <img src={cat.image_url} alt={cat.name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-accent"><Tag className="h-6 w-6 text-muted-foreground" /></div>
            )}
          </div>
          <p className="mt-1.5 text-xs font-semibold text-foreground text-center truncate">{cat.name}</p>
        </Link>
      ))}
    </div>
  );
}

/** Style 3: Rectangle cards in grid layout */
function RectGrid({ categories, storeSlug }: { categories: Category[]; storeSlug: string }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {categories.map((cat) => (
        <Link key={cat.id} to={storefrontPath(storeSlug, `category/${cat.slug}`)} className="group">
          <div className="w-full rounded-xl overflow-hidden border border-border transition-all group-hover:shadow-md" style={{ aspectRatio: "16/9" }}>
            {cat.image_url ? (
              <img src={cat.image_url} alt={cat.name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-accent"><Tag className="h-6 w-6 text-muted-foreground" /></div>
            )}
          </div>
          <p className="mt-1.5 text-xs font-semibold text-foreground text-center truncate">{cat.name}</p>
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
            {cat.image_url ? (
              <img src={cat.image_url} alt={cat.name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-accent"><Tag className="h-8 w-8 text-muted-foreground" /></div>
            )}
          </div>
          <p className="mt-1.5 text-xs font-semibold text-foreground text-center truncate">{cat.name}</p>
        </Link>
      ))}
    </div>
  );
}

export default function UniversalCategories({ categories, storeSlug, isLoading, categoryStyle = "style-1" }: Props) {
  if (!isLoading && (!categories || categories.length === 0)) return null;

  const isCarousel = categoryStyle === "style-1" || categoryStyle === "style-2";

  return (
    <div className="bg-card/80 backdrop-blur-md">
      <div className="mx-auto max-w-6xl px-4 py-4">
        {isLoading ? (
          isCarousel ? (
            <div className="flex gap-4 overflow-hidden">
              {Array.from({ length: 6 }).map((_, i) =>
                categoryStyle === "style-2" ? <RectSkeleton key={i} /> : <CircleSkeleton key={i} />
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => <GridSkeleton key={i} />)}
            </div>
          )
        ) : (
          <>
            {categoryStyle === "style-1" && <CircleCarousel categories={categories!} storeSlug={storeSlug} />}
            {categoryStyle === "style-2" && <RectCarousel categories={categories!} storeSlug={storeSlug} />}
            {categoryStyle === "style-3" && <RectGrid categories={categories!} storeSlug={storeSlug} />}
            {categoryStyle === "style-4" && <SquareGrid categories={categories!} storeSlug={storeSlug} />}
          </>
        )}
      </div>
    </div>
  );
}
