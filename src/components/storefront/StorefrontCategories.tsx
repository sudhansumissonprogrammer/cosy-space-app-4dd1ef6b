import { Tag } from "lucide-react";

interface Category {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
}

interface StorefrontCategoriesProps {
  categories: Category[] | undefined;
  activeCategory: string | null;
  onCategoryChange: (category: string | null) => void;
}

export default function StorefrontCategories({ categories, activeCategory, onCategoryChange }: StorefrontCategoriesProps) {
  if (!categories || categories.length === 0) return null;

  return (
    <div className="border-b bg-card">
      <div className="mx-auto max-w-6xl px-4 py-4">
        <div className="flex gap-5 overflow-x-auto pb-1 scrollbar-hide">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => onCategoryChange(activeCategory === cat.name ? null : cat.name)}
              className="flex flex-col items-center gap-2 flex-shrink-0 transition-all"
            >
              <div
                className={`h-16 w-16 rounded-full border-2 overflow-hidden transition-all sm:h-20 sm:w-20 ${
                  activeCategory === cat.name
                    ? "border-primary shadow-md"
                    : "border-border hover:border-primary/50 hover:shadow-sm"
                }`}
              >
                {cat.image_url ? (
                  <img src={cat.image_url} alt={cat.name} className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-accent">
                    <Tag className="h-5 w-5 text-muted-foreground sm:h-6 sm:w-6" />
                  </div>
                )}
              </div>
              <span
                className={`text-xs font-semibold uppercase tracking-wide max-w-[72px] truncate sm:max-w-[80px] ${
                  activeCategory === cat.name ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {cat.name}
              </span>
            </button>
          ))}
          <button
            onClick={() => onCategoryChange(null)}
            className="flex flex-col items-center gap-2 flex-shrink-0 transition-all"
          >
            <div
              className={`flex h-16 w-16 items-center justify-center rounded-full border-2 transition-all sm:h-20 sm:w-20 ${
                activeCategory === null
                  ? "border-primary bg-primary/10 shadow-md"
                  : "border-border bg-accent hover:border-primary/50 hover:shadow-sm"
              }`}
            >
              <Tag className="h-5 w-5 text-foreground sm:h-6 sm:w-6" />
            </div>
            <span
              className={`text-xs font-semibold uppercase tracking-wide max-w-[72px] truncate sm:max-w-[80px] ${
                activeCategory === null ? "text-primary" : "text-muted-foreground"
              }`}
            >
              All
            </span>
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => onCategoryChange(activeCategory === cat.name ? null : cat.name)}
              className="flex flex-col items-center gap-2 flex-shrink-0 transition-all"
            >
              <div
                className={`h-16 w-16 rounded-full border-2 overflow-hidden transition-all sm:h-20 sm:w-20 ${
                  activeCategory === cat.name
                    ? "border-primary shadow-md"
                    : "border-border hover:border-primary/50 hover:shadow-sm"
                }`}
              >
                {cat.image_url ? (
                  <img src={cat.image_url} alt={cat.name} className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-accent">
                    <Tag className="h-5 w-5 text-muted-foreground sm:h-6 sm:w-6" />
                  </div>
                )}
              </div>
              <span
                className={`text-xs font-semibold uppercase tracking-wide max-w-[72px] truncate sm:max-w-[80px] ${
                  activeCategory === cat.name ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {cat.name}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
