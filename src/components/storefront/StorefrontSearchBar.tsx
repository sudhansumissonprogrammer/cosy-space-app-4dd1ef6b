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

  // Fire Search event (debounced) when the user pauses typing on a non-empty query.
  // Deduped per session via sessionStorage so the same query never fires twice
  // even if the search bar remounts (route change, theme switch, etc.).
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) return;
    const timer = setTimeout(() => {
      try {
        const key = "sf_search_fired";
        const raw = sessionStorage.getItem(key) || "";
        const fired = new Set(raw ? raw.split("\n") : []);
        if (fired.has(q)) return;
        fired.add(q);
        // Cap at 50 entries to keep the cookie tiny
        const arr = Array.from(fired).slice(-50);
        sessionStorage.setItem(key, arr.join("\n"));
      } catch {}
      const storeId = (window as any).__SF_STORE_ID__;
      Promise.all([
        import("@/hooks/useFacebookPixel"),
        import("@/lib/metaCapi"),
        import("@/hooks/useGA4"),
      ]).then(([pixelMod, capiMod, gaMod]) => {
        const eid = pixelMod.generateEventId();
        pixelMod.fbPixelTrack("Search", { search_string: q }, eid);
        if (storeId) {
          capiMod.fireMetaCAPI({
            storeId,
            eventName: "Search",
            eventId: eid,
            customData: { search_string: q } as any,
          });
        }
        gaMod.ga4Track("search", { search_term: q });
      }).catch(() => {});
    }, 900);
    return () => clearTimeout(timer);
  }, [searchQuery]);

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
    <div ref={wrapperRef} className="search-focus-expand relative flex-1 z-[60]">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 50%, transparent)" }} />
      <Input
        placeholder="Search products..."
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        onFocus={() => setFocused(true)}
        className="pl-9 pr-10 rounded-full border-0 focus-visible:ring-1 focus-visible:ring-offset-0"
        style={{ backgroundColor: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 8%, transparent)", color: "var(--storefront-text, hsl(var(--foreground)))" }}
        maxLength={100}
      />
      {searchQuery && (
        <button
          onClick={() => onSearchChange("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
          style={{ color: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 50%, transparent)" }}
          aria-label="Clear search"
        >
          <X className="h-4 w-4" />
        </button>
      )}

      {showDropdown && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1.5 overflow-hidden rounded-xl shadow-lg"
          style={{ backgroundColor: "var(--storefront-bg, hsl(var(--popover)))", border: "1px solid color-mix(in srgb, var(--storefront-text, hsl(var(--border))) 15%, transparent)", color: "var(--storefront-text, hsl(var(--foreground)))" }}
        >
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
                    className="flex items-center gap-3 px-3 py-2.5 transition-colors"
                    style={{ backgroundColor: "transparent" }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 6%, transparent)"}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                  >
                    {p.image_url ? (
                      <img
                        src={p.image_url}
                        alt={p.name}
                        className="h-10 w-10 rounded-lg object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg flex-shrink-0" style={{ backgroundColor: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 8%, transparent)" }}>
                        <Package className="h-4 w-4" style={{ color: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 30%, transparent)" }} />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate" style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }}>
                        {p.name}
                      </p>
                      <p className="text-xs" style={{ color: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 50%, transparent)" }}>
                        {p.sale_price && p.sale_price < p.price ? (
                          <>
                            <span className="font-semibold" style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }}>
                              ₹{Number(p.sale_price).toFixed(0)}
                            </span>
                            <span className="ml-1 line-through">
                              ₹{Number(p.price).toFixed(0)}
                            </span>
                          </>
                        ) : (
                          <span className="font-semibold" style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }}>
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
            <div className="px-4 py-6 text-center text-sm" style={{ color: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 50%, transparent)" }}>
              No products found
            </div>
          )}
        </div>
      )}
    </div>
  );
}
