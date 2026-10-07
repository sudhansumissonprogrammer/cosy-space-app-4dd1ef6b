import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { optimizeImageUrl } from "@/lib/imageOptimize";
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

interface Design { id: string; slug: string; name: string; image_url: string | null }

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
      if (entry.isIntersecting) { setVisible(true); observer.disconnect(); }
    }, { root: rail, rootMargin: "0px 60px", threshold: 0.01 });
    observer.observe(node);
    return () => observer.disconnect();
  }, [rail]);
  return (
    <span ref={holder} className="block h-full w-full overflow-hidden rounded-[4px] bg-muted">
      {visible && <img src={optimizeImageUrl(design.image_url, 160)} alt={design.name}
        width={64} height={64} loading="lazy" decoding="async" fetchPriority="low"
        className="h-full w-full object-contain"
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
      const { data, error } = await supabase.from("products")
        .select("id,slug,name,image_url")
        .eq("store_id", storeId).eq("is_active", true)
        .eq("hidden_by_category", false).in("slug", [...SIMILAR_DESIGN_SLUGS]);
      if (error) throw error;
      return (data || []).filter((row): row is Design => !!row.slug);
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
  return (
    <section aria-label="Similar designs" className="mb-3 h-[108px] min-w-0">
      <h2 className="mb-2 text-sm font-semibold text-foreground">Similar designs{data ? ` (${items.length})` : ""}</h2>
      <div ref={setRail} className="relative flex gap-2 overflow-x-auto overscroll-x-contain py-1 pr-1 [scrollbar-width:thin]">
        {!data ? Array.from({ length: 6 }, (_, i) => <span key={i} className="h-[72px] w-[72px] shrink-0 rounded-md bg-muted" />) : items.map((design) => {
          const selected = design.id === current.id;
          return (
            <Button key={design.id} asChild variant="outline"
              className={`relative h-[72px] w-[72px] shrink-0 rounded-md p-1 border-2 ${selected ? "border-primary bg-background ring-1 ring-primary" : "border-border bg-background"}`}>
              <Link to={storefrontPath(storeSlug, `product/${design.slug}`)}
                aria-label={design.name} aria-current={selected ? "page" : undefined} title={design.name}>
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