import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { optimizeImageUrl } from "@/lib/imageOptimize";
import { setPdpPreload } from "@/lib/pdpPreload";
import { prefetchProductDetail } from "@/lib/prefetchProductDetail";
import { storefrontPath } from "@/lib/subdomain";

export const SIMILAR_DESIGN_SLUGS = [
  "trendy-2gram-micro-gold-plated-allure-premium-tradistional-fancy-stylish-new-hin-9jos5a",
  "micro-gold-plated-daily-use-pendant-set-asuc6f",
  "new-micro-gold-plated-chain-pendant-hp04dx",
  "micro-gold-plated-daily-wear-latest-design-chain-with-beautiful-krishna-design-p-eu8q3m",
  "one-gram-gold-plated-forming-ad-pendant-chain-d19zyi",
  "one-gram-gold-plated-forming-ad-pendant-chain-ay7shj",
  "elegant-aura-gold-art-pendant-a50f0k",
  "new-stylish-design-chain-and-locket-pack-of-1-fthbbl",
  "one-gram-gold-plated-chain-with-pendent-ex1phm",
  "micro-gold-plated-daily-use-pendant-set-asuc6e",
  "hanumanji-gold-plated-chain-locket-8zmrfl",
  "golden-pendent-with-chain-99en3l",
  "one-gram-gold-plated-forming-ad-pendant-chain-az719j",
] as const;

interface Design {
  id: string;
  slug: string;
  name: string;
  image_url: string | null;
  price?: number | null;
  sale_price?: number | null;
  currency?: string | null;
}

export function orderSimilarDesigns(rows: Design[], current: Design) {
  const bySlug = new Map(rows.map((row) => [row.slug, row]));
  const ordered = SIMILAR_DESIGN_SLUGS.flatMap((slug) => {
    const row = bySlug.get(slug);
    return row?.image_url ? [row.id === current.id ? current : row] : [];
  });
  return ordered.some((row) => row.id === current.id) || !current.image_url
    ? ordered : [current, ...ordered];
}

// Observe against the scroll rail, not the viewport: off-screen designs never
// download until approached, even with browsers' generous lazy-image margins.
function DesignPhoto({ design, rail }: { design: Design; rail: HTMLDivElement | null }) {
  const holder = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const node = holder.current;
    if (!node || !rail) return;
    if (!("IntersectionObserver" in window)) { setVisible(true); return; }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        prefetchProductDetail({ slug: design.slug, image: design.image_url });
        observer.disconnect();
      }
    }, { root: rail, rootMargin: "0px 60px", threshold: 0.01 });
    observer.observe(node);
    return () => observer.disconnect();
  }, [rail]);
  return (
    <span ref={holder} className="block h-full w-full overflow-hidden rounded-[4px] bg-muted">
      {visible && <img src={optimizeImageUrl(design.image_url, 160)} alt={design.name}
        width={64} height={64} loading="lazy" decoding="async" fetchPriority="low"
         className="h-full w-full object-cover scale-110"
        onError={(event) => {
          const image = event.currentTarget;
          if (design.image_url && image.getAttribute("src") !== design.image_url) image.src = design.image_url;
        }} />}
    </span>
  );
}

export default function ImitationWorldSimilarDesigns({ storeId, storeSlug, current }: {
  storeId: string; storeSlug: string; current: Design;
}) {
  const [ready, setReady] = useState(false);
  const [rail, setRail] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    // Yield to the PDP's first paint. No catalog fetch blocks the main photo.
    const timer = window.setTimeout(() => setReady(true), 350);
    return () => window.clearTimeout(timer);
  }, []);
  const { data, isError } = useQuery({
    queryKey: ["imitationworld-similar-designs", storeId],
    enabled: ready && storeSlug === "imitationworld",
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: false,
    queryFn: async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data, error } = await supabase.rpc("get_category_products_page", {
        _store_id: storeId, _category_name: "Chain with Pendant", _offset: 0, _limit: 100,
      });
      if (error) throw error;
      const rows = Array.isArray(data) ? data as unknown as Design[] : [];
      const wanted = new Set<string>(SIMILAR_DESIGN_SLUGS);
      return rows.filter((row) => !!row.slug && wanted.has(row.slug));
    },
  });
  const items = data ? orderSimilarDesigns(data, current) : [];
  useEffect(() => {
    if (!rail || !data) return;
    const selected = rail.querySelector<HTMLElement>('[aria-current="page"]');
    if (!selected) return;
    rail.scrollLeft = Math.max(0, selected.offsetLeft - rail.offsetLeft - rail.clientWidth / 2 + selected.clientWidth / 2);
  }, [rail, data, current.id]);

  if (storeSlug !== "imitationworld" || isError || (data && items.length < 2)) return null;
  const warmDesign = (design: Design) => {
    prefetchProductDetail({ slug: design.slug, image: design.image_url });
  };
  const rememberDesign = (design: Design) => {
    if (design.image_url) {
      setPdpPreload({
        slug: design.slug,
        image: design.image_url,
        name: design.name,
        price: design.price == null ? null : Number(design.price),
        salePrice: design.sale_price == null ? null : Number(design.sale_price),
        currency: design.currency || "INR",
      });
    }
    warmDesign(design);
  };
  return (
    <section aria-label="Similar designs" className="mb-3 h-[92px] min-w-0 sm:h-[108px]">
      <h2 className="mb-1.5 text-sm font-semibold text-foreground sm:mb-2">Similar designs{data ? ` (${items.length})` : ""}</h2>
      <div ref={setRail} className="relative flex gap-1.5 overflow-x-auto overscroll-x-contain py-0.5 pr-1 sm:gap-2 sm:py-1 [scrollbar-width:thin]">
        {!data ? Array.from({ length: 7 }, (_, i) => <span key={i} className="h-[58px] w-[58px] shrink-0 rounded bg-muted sm:h-[72px] sm:w-[72px] sm:rounded-md" />) : items.map((design) => {
          const selected = design.id === current.id;
          return (
            <Button key={design.id} asChild variant="outline"
               className={`relative h-[58px] w-[58px] shrink-0 overflow-hidden rounded p-0 border-2 sm:h-[72px] sm:w-[72px] sm:rounded-md ${selected ? "border-primary bg-background ring-1 ring-primary" : "border-border bg-background"}`}>
              <Link to={storefrontPath(storeSlug, `product/${design.slug}`)}
                aria-label={design.name} aria-current={selected ? "page" : undefined} title={design.name}
                onPointerEnter={() => warmDesign(design)} onFocus={() => warmDesign(design)}
                onTouchStart={() => warmDesign(design)} onClick={() => rememberDesign(design)}>
                <DesignPhoto design={design} rail={rail} />
                {selected && <span className="absolute bottom-0 right-0 rounded-tl-md bg-primary p-0.5 text-primary-foreground"><Check className="h-3 w-3" aria-hidden="true" /></span>}
              </Link>
            </Button>
          );
        })}
      </div>
    </section>
  );
}