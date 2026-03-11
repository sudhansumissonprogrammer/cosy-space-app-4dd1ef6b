import { useState, useRef, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { Search, X, Package } from "lucide-react";
import { Input } from "@/components/ui/input";
import { storefrontPath } from "@/lib/subdomain";
import type { Tables } from "@/integrations/supabase/types";

interface StorefrontSearchBarProps {
  products: Tables<"products">[] | undefined;
  slug: string;
  searchQuery: string;
  onSearchChange: (value: string) => void;
}

export default function StorefrontSearchBar({
  products,
  slug,
  searchQuery,
  onSearchChange,
}: StorefrontSearchBarProps) {
  const [focused, setFocused] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setFocused(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const suggestions = useMemo(() => {
    if (!searchQuery.trim() || !products) return [];
    const q = searchQuery.toLowerCase();
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q) ||
          p.category?.toLowerCase().includes(q)
      )
      .slice(0, 6);
  }, [searchQuery, products]);

  const showDropdown = focused && searchQuery.trim().length > 0;

  return (
    <div ref={wrapperRef} className="relative flex-1 z-[60]">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        placeholder="Search products..."
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        onFocus={() => setFocused(true)}
        className="pl-9 pr-10 rounded-full border-0 bg-accent/60 focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:ring-offset-0"
        maxLength={100}
      />
      {searchQuery && (
        <button
          onClick={() => onSearchChange("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      )}

      {showDropdown && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1.5 overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
          {suggestions.length > 0 ? (
            <ul className="max-h-[320px] overflow-y-auto py-1">
              {suggestions.map((p) => (
                <li key={p.id}>
                  <Link
                    to={storefrontPath(slug, `product/${p.slug || p.id}`)}
                    onClick={() => {
                      setFocused(false);
                      onSearchChange("");
                    }}
                    className="flex items-center gap-3 px-3 py-2.5 hover:bg-accent/60 transition-colors"
                  >
                    {p.image_url ? (
                      <img
                        src={p.image_url}
                        alt={p.name}
                        className="h-10 w-10 rounded-lg object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary/40 flex-shrink-0">
                        <Package className="h-4 w-4 text-muted-foreground/50" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">
                        {p.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {p.sale_price && p.sale_price < p.price ? (
                          <>
                            <span className="font-semibold text-foreground">
                              ₹{Number(p.sale_price).toFixed(0)}
                            </span>
                            <span className="ml-1 line-through">
                              ₹{Number(p.price).toFixed(0)}
                            </span>
                          </>
                        ) : (
                          <span className="font-semibold text-foreground">
                            ₹{Number(p.price).toFixed(0)}
                          </span>
                        )}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              No products found
            </div>
          )}
        </div>
      )}
    </div>
  );
}
