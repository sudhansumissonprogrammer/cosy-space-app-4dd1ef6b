import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { storefrontPath } from "@/lib/subdomain";
import { optimizeImageUrl } from "@/lib/imageOptimize";
import { LayoutGrid } from "lucide-react";

interface Props { storeId: string; slug: string; activeCategory?: string }

/**
 * Horizontal quick-jump pill row. Uses cached `categories-shop` query.
 *
 * PERF (mobile / India 4G): each chip avatar is only 24px, but the stored
 * category image is a single 800w WebP (~120-150KB). Loading 15 of those on
 * page entry burned ~1.8MB and competed with the product-grid LCP image.
 * Chip thumbnails are now:
 *   1. mounted only after the page is idle (never during LCP), and
 *   2. fetched only when the chip actually scrolls into the strip's viewport.
 * Chips render instantly with a neutral placeholder circle, so layout and
 * appearance are unchanged.
 */
export default function CategoryQuickJump({ storeId, slug, activeCategory }: Props) {
  const { data: cats = [] } = useQuery({
    queryKey: ["categories-shop", storeId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("categories")
        .select("id, name, slug, image_url")
        .eq("store_id", storeId)
        .order("display_order", { ascending: true })
        .limit(20);
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [thumbsReady, setThumbsReady] = useState(false);
  const [visible, setVisible] = useState<Record<string, boolean>>({});

  // 1. Never fetch chip avatars while the main grid is still painting.
  useEffect(() => {
    let cancelled = false;
    const go = () => { if (!cancelled) setThumbsReady(true); };
    const ric = (window as any).requestIdleCallback as
      | ((cb: () => void, o?: { timeout: number }) => number)
      | undefined;
    const h = ric ? ric(go, { timeout: 2500 }) : window.setTimeout(go, 1200);
    return () => {
      cancelled = true;
      if (ric) (window as any).cancelIdleCallback?.(h);
      else window.clearTimeout(h as number);
    };
  }, []);

  // 2. Only fetch the avatars of chips actually scrolled into view.
  useEffect(() => {
    if (!thumbsReady || !scrollerRef.current) return;
    const root = scrollerRef.current;
    const io = new IntersectionObserver(
      (entries) => {
        const next: Record<string, boolean> = {};
        for (const e of entries) {
          const id = (e.target as HTMLElement).dataset.catId;
          if (e.isIntersecting && id) next[id] = true;
        }
        if (Object.keys(next).length) setVisible((p) => ({ ...p, ...next }));
      },
      { root, rootMargin: "200px" },
    );
    root.querySelectorAll<HTMLElement>("[data-cat-id]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [thumbsReady, cats.length]);

  if (!cats.length) return null;

  const isAllActive = !activeCategory;

  return (
    <div className="-mx-3 sm:-mx-4 lg:-mx-6 px-3 sm:px-4 lg:px-6 mb-3">
      <div ref={scrollerRef} className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        <Link
          to={storefrontPath(slug, "shop")}
          className={`shrink-0 inline-flex items-center gap-1.5 px-3 h-8 rounded-full text-[12px] font-semibold transition-colors ${
            isAllActive
              ? "bg-foreground text-background"
              : "bg-card border border-border text-foreground hover:bg-accent"
          }`}
        >
          <LayoutGrid className="h-3.5 w-3.5" />
          All
        </Link>
        {cats.map((c: any) => {
          const active = activeCategory === c.slug;
          const showThumb = c.image_url && thumbsReady && visible[c.id];
          return (
            <Link
              key={c.id}
              data-cat-id={c.id}
              to={storefrontPath(slug, `category/${c.slug}`)}
              className={`shrink-0 inline-flex items-center gap-2 pl-1 pr-3 h-8 rounded-full text-[12px] font-semibold transition-colors ${
                active
                  ? "bg-foreground text-background"
                  : "bg-card border border-border text-foreground hover:bg-accent"
              }`}
            >
              {showThumb ? (
                <img
                  src={optimizeImageUrl(c.image_url, 96, 60)}
                  alt=""
                  width={24}
                  height={24}
                  className="h-6 w-6 rounded-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <span className="h-6 w-6 rounded-full bg-accent" />
              )}
              <span className="truncate max-w-[110px] capitalize">{c.name}</span>
            </Link>
          );
        })}
      </div>
      <style>{`.no-scrollbar::-webkit-scrollbar{display:none}.no-scrollbar{scrollbar-width:none}`}</style>
    </div>
  );
}
