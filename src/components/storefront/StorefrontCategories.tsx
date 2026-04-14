import { Tag } from "lucide-react";
import SectionHeading from "@/components/storefront/SectionHeading";
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { storefrontPath } from "@/lib/subdomain";

interface Category {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
}

interface StorefrontCategoriesProps {
  categories: Category[] | undefined;
  storeSlug: string;
  isLoading?: boolean;
}

function CategorySkeleton() {
  return (
    <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
      <Skeleton className="h-16 w-16 rounded-full sm:h-20 sm:w-20" />
      <Skeleton className="h-3 w-14" />
    </div>
  );
}

export default function StorefrontCategories({ categories, storeSlug, isLoading }: StorefrontCategoriesProps) {
  if (!isLoading && (!categories || categories.length === 0)) return null;

  return (
    <div className="backdrop-blur-md" style={{ backgroundColor: "var(--storefront-bg, hsl(var(--background)))" }}>
        <div className="mx-auto max-w-7xl px-4 py-5">
          <SectionHeading title="Shop by Category" />
        <div className="flex gap-4 overflow-x-auto pb-1 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}>
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => <CategorySkeleton key={i} />)
          ) : (
            categories!.map((cat) => (
              <Link
                key={cat.id}
                to={storefrontPath(storeSlug, `category/${cat.slug}`)}
                className="flex flex-col items-center gap-1.5 flex-shrink-0 transition-all"
              >
                <div className="h-20 w-20 rounded-full border-2 overflow-hidden transition-all sm:h-20 sm:w-20 border-border" style={{ "--tw-border-opacity": 1 } as any} onMouseEnter={(e) => e.currentTarget.style.borderColor = "var(--storefront-primary, hsl(var(--primary)))"} onMouseLeave={(e) => e.currentTarget.style.borderColor = ""}>
                  {cat.image_url ? (
                    <img src={cat.image_url} alt={cat.name} className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center" style={{ backgroundColor: "var(--storefront-bg, hsl(var(--accent)))" }}>
                      <Tag className="h-5 w-5 sm:h-6 sm:w-6" style={{ color: "var(--storefront-text, hsl(var(--muted-foreground)))", opacity: 0.5 }} />
                    </div>
                  )}
                </div>
                <span className="text-[11px] font-semibold tracking-wide text-center leading-tight truncate max-w-[80px]" style={{ color: "var(--storefront-text, hsl(var(--foreground)))", fontFamily: "var(--storefront-heading-font, 'Alegreya SC'), serif" }}>
                  {cat.name}
                </span>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
