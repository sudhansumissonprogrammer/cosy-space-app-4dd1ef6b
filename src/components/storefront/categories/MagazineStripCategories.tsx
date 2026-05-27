import { Link } from "react-router-dom";
import { Tag } from "lucide-react";
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

export default function MagazineStripCategories({ categories, storeSlug }: { categories: Category[]; storeSlug: string }) {
  return (
    <div className="flex flex-col gap-3 md:grid md:grid-cols-2 lg:gap-4">
      {categories.map((cat, idx) => (
        <Link key={cat.id} to={storefrontPath(storeSlug, `category/${cat.slug}`)} className="group flex overflow-hidden rounded-2xl border border-border transition-all hover:shadow-lg" style={{ height: "clamp(100px, 20vw, 160px)", animation: `magazineSlideIn 0.4s ease-out ${idx * 0.08}s both` }}>
          <div className="w-[55%] sm:w-[60%] overflow-hidden">
            <CategoryImage cat={cat} size={600} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
          </div>
          <div className="flex-1 flex flex-col justify-center px-4 sm:px-6" style={{ background: "linear-gradient(135deg, var(--storefront-bg, hsl(var(--background))), var(--storefront-bg, hsl(var(--background))))" }}>
            <span className="text-sm sm:text-base font-bold leading-tight" style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }}>{cat.name}</span>
            <span className="mt-1.5 text-[10px] sm:text-xs font-medium opacity-60" style={{ color: "var(--storefront-primary, hsl(var(--primary)))" }}>Explore →</span>
          </div>
        </Link>
      ))}
      <style>{`@keyframes magazineSlideIn { from { opacity: 0; transform: translateX(-20px); } to { opacity: 1; transform: translateX(0); } }`}</style>
    </div>
  );
}
