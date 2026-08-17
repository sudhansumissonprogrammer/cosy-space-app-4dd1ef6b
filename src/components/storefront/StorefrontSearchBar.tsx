import { useState, useRef, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, X, Package, ArrowRight, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { storefrontPath } from "@/lib/subdomain";
import { useSearchSuggestions } from "@/hooks/useProductSearch";
import { pushRecentSearch, getRecentSearches } from "@/lib/searchSynonyms";
import type { Tables } from "@/integrations/supabase/types";

interface StorefrontSearchBarProps {
  products: Tables<"products">[] | undefined;
  slug: string;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  storeId?: string;
}

export default function StorefrontSearchBar({
  products,
  slug,
  searchQuery,
  onSearchChange,
  storeId,
}: StorefrontSearchBarProps) {
  const [focused, setFocused] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const navigate = useNavigate();
  const wrapperRef = useRef<HTMLDivElement>(null);

  const resolvedStoreId =
    storeId || (products?.[0] as any)?.store_id || (window as any).__SF_STORE_ID__ || "";

  const { products: hits, categories } = useSearchSuggestions(
    resolvedStoreId || undefined,
    searchQuery
  );

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setFocused(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (focused) {
      try {
        setRecent(getRecentSearches());
      } catch {
        setRecent([]);
      }
    }
  }, [focused]);

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
        // Cap at 50 entries to keep the storage tiny
        const arr = Array.from(fired).slice(-50);
        sessionStorage.setItem(key, arr.join("\n"));
      } catch {}
      const sid = resolvedStoreId;
      Promise.all([
        import("@/hooks/useFacebookPixel"),
        import("@/hooks/useGA4"),
        import("@/lib/storefrontEvents"),
      ])
        .then(([pixelMod, gaMod, sfMod]) => {
          const eid = pixelMod.generateEventId();
          pixelMod.fbPixelTrack("Search", { search_string: q }, eid);
          gaMod.ga4Track("search", { search_term: q });
          if (sid) {
            const hitCount = hits.length;
            sfMod.fireStorefrontEvent({
              storeId: sid,
              eventName: hitCount === 0 ? "search_no_results" : "search_performed",
              metadata: { query: q.slice(0, 100), results: hitCount },
            });
          }
        })
        .catch(() => {});
    }, 900);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, resolvedStoreId]);

  const submit = useCallback(
    (raw?: string) => {
      const q = (raw ?? searchQuery).trim();
      if (!q) return;
      try {
        pushRecentSearch(q);
      } catch {}
      setFocused(false);
      navigate(`${storefrontPath(slug, "search")}?q=${encodeURIComponent(q)}`);
    },
    [searchQuery, navigate, slug]
  );

  const showDropdown = focused && (searchQuery.trim().length > 0 || recent.length > 0);
  const textColor = "var(--storefront-text, hsl(var(--foreground)))";
  const muted = "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 50%, transparent)";

  return (
    <div ref={wrapperRef} className="search-focus-expand relative flex-1 z-[60]">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: muted }} />
      <Input
        placeholder="Search products..."
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          } else if (e.key === "Escape") {
            setFocused(false);
          }
        }}
        enterKeyHint="search"
        className="pl-9 pr-10 rounded-full border-0 focus-visible:ring-1 focus-visible:ring-offset-0"
        style={{
          backgroundColor: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 8%, transparent)",
          color: textColor,
        }}
        maxLength={100}
      />
      {searchQuery && (
        <button
          onClick={() => onSearchChange("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
          style={{ color: muted }}
          aria-label="Clear search"
        >
          <X className="h-4 w-4" />
        </button>
      )}

      {showDropdown && (
        <div
          className="absolute left-0 right-0 top-full z-50 mt-1.5 overflow-hidden rounded-xl shadow-lg"
          style={{
            backgroundColor: "var(--storefront-bg, hsl(var(--popover)))",
            border: "1px solid color-mix(in srgb, var(--storefront-text, hsl(var(--border))) 15%, transparent)",
            color: textColor,
          }}
        >
          {searchQuery.trim().length === 0 ? (
            <ul className="max-h-[320px] overflow-y-auto py-1">
              {recent.map((term) => (
                <li key={term}>
                  <button
                    onClick={() => {
                      onSearchChange(term);
                      submit(term);
                    }}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm"
                  >
                    <Clock className="h-4 w-4 flex-shrink-0" style={{ color: muted }} />
                    <span className="truncate">{term}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <button
              onClick={() => submit()}
              className="flex w-full items-center justify-between gap-2 px-4 py-3 text-sm font-medium"
              style={{ color: textColor }}
            >
              <span className="truncate">
                Show all products for "{searchQuery.trim()}"
                {hits.length > 0 ? ` (${hits.length})` : ""}
              </span>
              <ArrowRight className="h-4 w-4 flex-shrink-0" />
            </button>
          )}

        </div>
      )}
    </div>
  );
}
