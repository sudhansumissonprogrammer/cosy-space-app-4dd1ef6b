import { Link } from "react-router-dom";
import { PackageSearch, LayoutGrid } from "lucide-react";
import { storefrontPath } from "@/lib/subdomain";

interface ShopEmptyStateProps {
  slug: string;
  title?: string;
  message?: string;
  ctaLabel?: string;
  ctaTo?: string;
}

/** Friendly empty state with icon + CTA. No images, no network. */
export default function ShopEmptyState({
  slug,
  title = "Nothing here yet",
  message = "Browse other categories to find something you love.",
  ctaLabel = "Browse Categories",
  ctaTo,
}: ShopEmptyStateProps) {
  const to = ctaTo ?? storefrontPath(slug, "categories");
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed bg-card px-6 py-10 text-center">
      <div className="relative">
        <div className="absolute inset-0 bg-foreground/5 blur-2xl rounded-full" />
        <div className="relative h-16 w-16 rounded-2xl bg-accent/40 flex items-center justify-center">
          <PackageSearch className="h-8 w-8 text-muted-foreground" strokeWidth={1.6} />
        </div>
      </div>
      <h3 className="text-base font-bold text-foreground mt-1">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-xs">{message}</p>
      <Link
        to={to}
        className="mt-2 inline-flex items-center gap-2 rounded-full bg-foreground px-4 h-9 text-sm font-semibold text-background hover:bg-foreground/90 transition-colors"
      >
        <LayoutGrid className="h-4 w-4" />
        {ctaLabel}
      </Link>
    </div>
  );
}
