import { Link } from "react-router-dom";
import { storefrontPath } from "@/lib/subdomain";
import CategoryCollageImage, { type StorefrontCategoryImage } from "../CategoryCollageImage";

type Category = StorefrontCategoryImage;

const CategoryImage = ({ cat, size, className }: { cat: Category; size?: number; className?: string }) => <CategoryCollageImage category={cat} size={size} className={className} />;

export default function MagazineStripCategories({ categories, storeSlug }: { categories: Category[]; storeSlug: string }) {
  return (
    <div className="flex flex-col gap-3 md:grid md:grid-cols-2 lg:gap-4">
      {categories.map((cat, idx) => (
        <Link key={cat.id} to={storefrontPath(storeSlug, `category/${cat.slug}`)} className="group flex overflow-hidden rounded-2xl border border-border transition-[transform,opacity,colors,box-shadow] hover:shadow-lg" style={{ height: "clamp(100px, 20vw, 160px)", animation: `magazineSlideIn 0.4s ease-out ${idx * 0.08}s both` }}>
          <div className="w-[55%] sm:w-[60%] overflow-hidden">
            <CategoryImage cat={cat} size={600} className="h-full w-full object-cover transition-transform duration-500 hh:group-hover:scale-105" />
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
