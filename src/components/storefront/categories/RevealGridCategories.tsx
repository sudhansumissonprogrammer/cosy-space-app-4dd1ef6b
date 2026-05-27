import { useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, Tag } from "lucide-react";
import { storefrontPath } from "@/lib/subdomain";
import { optimizeImageUrl } from "@/lib/imageOptimize";

interface Category { id: string; name: string; slug: string; image_url: string | null; }

function CategoryImage({ cat, size = 500, className = "h-full w-full object-cover" }: { cat: Category; size?: number; className?: string }) {
  if (cat.image_url) return <img src={optimizeImageUrl(cat.image_url, size, 85)} alt={cat.name} className={className} loading="lazy" width={size} height={size} />;
  return (
    <div className="flex h-full w-full items-center justify-center" style={{ backgroundColor: "var(--storefront-bg, hsl(var(--accent)))" }}>
      <Tag className="h-5 w-5" style={{ color: "var(--storefront-text, hsl(var(--muted-foreground)))", opacity: 0.5 }} />
    </div>
  );
}

export default function RevealGridCategories({ categories, storeSlug }: { categories: Category[]; storeSlug: string }) {
  const [page, setPage] = useState(0);
  const perPage = 2;
  const totalPages = Math.ceil(categories.length / perPage);
  const [animKey, setAnimKey] = useState(0);

  const goNext = useCallback(() => { setPage((p) => (p + 1) % totalPages); setAnimKey((k) => k + 1); }, [totalPages]);
  const goPrev = useCallback(() => { setPage((p) => (p - 1 + totalPages) % totalPages); setAnimKey((k) => k + 1); }, [totalPages]);

  const visible = categories.slice(page * perPage, page * perPage + perPage);

  return (
    <div>
      <div key={animKey} className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 lg:gap-4">
        {visible.map((cat, idx) => (
          <Link key={cat.id} to={storefrontPath(storeSlug, `category/${cat.slug}`)} className="group relative overflow-hidden rounded-2xl" style={{ aspectRatio: "1/1", animation: `revealSlideUp 0.45s cubic-bezier(0.22, 1, 0.36, 1) ${idx * 0.12}s both` }}>
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
          <button onClick={goPrev} className="h-9 w-9 rounded-full flex items-center justify-center transition-all active:scale-95" style={{ border: "1px solid color-mix(in srgb, var(--storefront-text, hsl(var(--border))) 15%, transparent)" }} aria-label="Previous"><ChevronLeft className="h-4 w-4" /></button>
          <div className="flex gap-1.5">
            {Array.from({ length: totalPages }).map((_, i) => (
              <div key={i} className="h-1.5 rounded-full transition-all duration-300" style={{ width: i === page ? 20 : 6, backgroundColor: i === page ? "var(--storefront-primary, hsl(var(--primary)))" : "var(--border)" }} />
            ))}
          </div>
          <button onClick={goNext} className="h-9 w-9 rounded-full flex items-center justify-center transition-all active:scale-95" style={{ border: "1px solid color-mix(in srgb, var(--storefront-text, hsl(var(--border))) 15%, transparent)" }} aria-label="Next"><ChevronRight className="h-4 w-4" /></button>
        </div>
      )}
      <style>{`@keyframes revealSlideUp { from { opacity: 0; transform: translateY(40px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }`}</style>
    </div>
  );
}
