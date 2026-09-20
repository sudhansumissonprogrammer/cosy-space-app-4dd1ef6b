import { useState, useCallback, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { storefrontPath } from "@/lib/subdomain";
import CategoryCollageImage, { type StorefrontCategoryImage } from "../CategoryCollageImage";

type Category = StorefrontCategoryImage;

const CategoryImage = ({ cat, size, className }: { cat: Category; size?: number; className?: string }) => <CategoryCollageImage category={cat} size={size} className={className} />;

export default function TwoRowCircleCarouselCategories({ categories, storeSlug }: { categories: Category[]; storeSlug: string }) {
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

  const scroll = useCallback((dir: number) => { scrollRef.current?.scrollBy({ left: dir * 260, behavior: "smooth" }); }, []);

  const half = Math.ceil(categories.length / 2);
  const row1 = categories.slice(0, half);
  const row2 = categories.slice(half);
  const columns: [Category, Category | undefined][] = [];
  const maxCols = Math.max(row1.length, row2.length);
  for (let i = 0; i < maxCols; i++) columns.push([row1[i] || row2[i]!, i < row2.length ? row2[i] : undefined]);

  return (
    <div className="relative group/carousel">
      {canLeft && (
        <button onClick={() => scroll(-1)} className="sf-hit-40 absolute left-0 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full flex items-center justify-center shadow-md opacity-0 group-hover/carousel:opacity-100 transition-opacity" style={{ backgroundColor: "var(--storefront-bg, hsl(var(--background)))", border: "1px solid var(--border)" }} aria-label="Scroll left">
          <ChevronLeft className="h-4 w-4" style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }} />
        </button>
      )}
      {canRight && (
        <button onClick={() => scroll(1)} className="sf-hit-40 absolute right-0 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full flex items-center justify-center shadow-md opacity-0 group-hover/carousel:opacity-100 transition-opacity" style={{ backgroundColor: "var(--storefront-bg, hsl(var(--background)))", border: "1px solid var(--border)" }} aria-label="Scroll right">
          <ChevronRight className="h-4 w-4" style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }} />
        </button>

      )}
      <div ref={scrollRef} className="overflow-x-auto scrollbar-hide" style={{ scrollbarWidth: "none", msOverflowStyle: "none", WebkitOverflowScrolling: "touch" }}>
        <div className="flex gap-3 sm:gap-4 w-max">
          {columns.map((col, colIdx) => (
            <div key={colIdx} className="flex flex-col gap-3 sm:gap-4 flex-shrink-0">
              {col.map((cat, rowIdx) =>
                cat ? (
                  <Link key={cat.id} to={storefrontPath(storeSlug, `category/${cat.slug}`)} className="flex flex-col items-center gap-1 transition-[transform,opacity,colors,box-shadow]">
                    <div className="h-[80px] w-[80px] sm:h-[96px] sm:w-[96px] md:h-[120px] md:w-[120px] rounded-full border-2 overflow-hidden transition-[transform,opacity,colors,box-shadow] border-border bg-secondary/30" onMouseEnter={(e) => e.currentTarget.style.borderColor = "var(--storefront-primary, hsl(var(--primary)))"} onMouseLeave={(e) => e.currentTarget.style.borderColor = ""}>
                      <CategoryImage cat={cat} size={300} className="h-full w-full object-cover scale-110" />
                    </div>
                    <span className="text-[10px] sm:text-[11px] font-semibold tracking-wide text-center leading-tight max-w-[80px] sm:max-w-[96px] md:max-w-[120px] truncate" style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }}>{cat.name}</span>
                  </Link>
                ) : (
                  <div key={`empty-${rowIdx}`} className="h-[80px] w-[80px] sm:h-[96px] sm:w-[96px] md:h-[120px] md:w-[120px]" />
                )
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
