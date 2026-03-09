import { Tag } from "lucide-react";
import { Link } from "react-router-dom";

interface Category {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
}

interface StorefrontCategoriesProps {
  categories: Category[] | undefined;
  storeSlug: string;
}

export default function StorefrontCategories({ categories, storeSlug }: StorefrontCategoriesProps) {
  if (!categories || categories.length === 0) return null;

  return (
    <div className="bg-background">
      <div className="mx-auto max-w-6xl px-4 py-4">
        <div className="flex gap-4 overflow-x-auto pb-1 scrollbar-hide">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              to={`/store/${storeSlug}/category/${cat.slug}`}
              className="flex flex-col items-center gap-1.5 flex-shrink-0 transition-all"
            >
              <div className="h-16 w-16 rounded-full border-2 overflow-hidden transition-all sm:h-20 sm:w-20 border-border hover:border-primary/50 hover:shadow-sm">
                {cat.image_url ? (
                  <img src={cat.image_url} alt={cat.name} className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-accent">
                    <Tag className="h-5 w-5 text-muted-foreground sm:h-6 sm:w-6" />
                  </div>
                )}
              </div>
              <span className="text-[11px] font-medium uppercase tracking-wide text-foreground text-center leading-tight" style={{ fontFamily: "sans-serif" }}>
                {cat.name}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
