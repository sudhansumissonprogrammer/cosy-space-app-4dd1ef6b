/**
 * BrandCarouselGroups — brand-grouped horizontal carousels for a single
 * category page (Utkal Watch → /category/sale).
 *
 * Perf notes:
 *  - No embla / autoplay / extra deps: plain CSS scroll-snap row. Zero JS on
 *    scroll, so cold-load cost over the normal grid is ~0.
 *  - Rendered through React.lazy from CategoryDetail and only for the one
 *    store+category that opts in, so every other storefront ships nothing.
 *  - Mobile shows 2 full cards + a peek of the third (44% basis) so the row
 *    reads as swipeable.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import UniversalProductCard from "./UniversalProductCard";
import type { StoreData } from "@/layouts/StorefrontLayout";

interface Props {
  products: any[];
  slug: string;
  store: StoreData;
  cardStyle?: string;
}

/** Ordered brand groups. `match` runs on the normalized (a-z0-9 only) name. */
const BRANDS: { key: string; label: string; match: (n: string) => boolean }[] = [
  { key: "seiko", label: "Seiko Trending", match: (n) => n.includes("seiko") || n.startsWith("seko") },
  { key: "casio", label: "Casio Illuminator", match: (n) => n.includes("casio") || n.includes("iluminator") || n.includes("illuminator") },
  { key: "tissot", label: "Tissot", match: (n) => n.includes("tisso") },
  { key: "rado", label: "Rado", match: (n) => n.includes("rado") || n.includes("raddo") },
  { key: "fossil", label: "Fossil", match: (n) => n.includes("fossil") || n.includes("fossiil") },
  { key: "hublot", label: "Hublot", match: (n) => n.includes("hublot") || n.includes("hublo") },
  { key: "rolex", label: "Rolex", match: (n) => n.includes("rolex") },
  { key: "patek-philippe", label: "Patek Philippe", match: (n) => n.includes("patekphil") },
  { key: "audemars-piguet", label: "Audemars Piguet", match: (n) => n.includes("audemarspiguet") },
  { key: "cartier", label: "Cartier", match: (n) => n.includes("cartier") },
];

const normalize = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

export function groupSaleProductsByBrand(products: any[]) {
  const used = new Set<string>();
  const out: { key: string; label: string; items: any[] }[] = [];
  for (const brand of BRANDS) {
    const items = products.filter((p) => {
      if (used.has(p.id) || !brand.match(normalize(p.name))) return false;
      used.add(p.id);
      return true;
    });
    if (items.length) out.push({ key: brand.key, label: brand.label, items });
  }
  const rest = products.filter((p) => !used.has(p.id));
  if (rest.length) out.push({ key: "more", label: "More Watches", items: rest });
  return out;
}

interface BrandRailProps extends Props {
  group: { key: string; label: string; items: any[] };
  groupIndex: number;
}

/**
 * Mount each rail only when it approaches the viewport, then reveal more cards
 * as the shopper scrolls horizontally. Native image lazy-loading alone starts
 * downloads several screens early, which previously fetched the whole Sale
 * collection during the first load.
 */
function BrandRail({ group, groupIndex, slug, store, cardStyle }: BrandRailProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const [isNearViewport, setIsNearViewport] = useState(groupIndex === 0);
  const [visibleCount, setVisibleCount] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(min-width: 640px)").matches ? 12 : 6
  );

  useEffect(() => {
    if (isNearViewport) return;
    const section = sectionRef.current;
    if (!section || typeof IntersectionObserver === "undefined") {
      setIsNearViewport(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setIsNearViewport(true);
        observer.disconnect();
      },
      { rootMargin: "500px 0px" }
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, [isNearViewport]);

  const visibleItems = isNearViewport ? group.items.slice(0, visibleCount) : [];
  const hasMore = visibleCount < group.items.length;

  const revealMore = () => {
    if (hasMore) setVisibleCount((count) => Math.min(count + 8, group.items.length));
  };

  return (
    <section ref={sectionRef}>
      <div className="mb-2.5 flex items-baseline justify-between px-0.5">
        <h2
          className="text-[15px] sm:text-lg font-semibold tracking-tight"
          style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }}
        >
          {group.label}
        </h2>
        <span className="text-[11px] opacity-60" style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }}>
          {group.items.length} {group.items.length === 1 ? "watch" : "watches"}
        </span>
      </div>

      <div
        className="brand-rail -mx-3 grid grid-flow-col [grid-template-rows:auto_auto] items-start auto-cols-[49%] snap-x snap-mandatory gap-x-1 gap-y-1 overflow-x-auto scroll-px-2 px-2 pb-1 scrollbar-hide sm:mx-0 sm:auto-cols-[32.5%] sm:gap-x-1.5 sm:px-0 sm:scroll-px-0 md:auto-cols-[24.5%] lg:auto-cols-[19.6%]"
        style={{
          overscrollBehaviorX: "contain",
          WebkitOverflowScrolling: "touch",
          // Reserve space only while a below-fold rail is deferred. Keeping a
          // fixed 620px height after cards mount stretches the two grid rows
          // and creates a large blank band between them on mobile.
          minHeight: isNearViewport ? undefined : 620,
        }}
        onScroll={(event) => {
          if (!hasMore) return;
          const rail = event.currentTarget;
          if (rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - rail.clientWidth * 0.75) revealMore();
        }}
      >
        {/* Each column stacks its own two cards, so a taller card further along
            the rail can never stretch a shared row and open a gap. */}
        {Array.from({ length: Math.ceil(visibleItems.length / 2) }, (_, col) => (
          <div key={visibleItems[col * 2].id} className="row-span-2 flex snap-start flex-col gap-1">
            {visibleItems.slice(col * 2, col * 2 + 2).map((product, j) => {
              const idx = col * 2 + j;
              return (
                <UniversalProductCard
                  key={product.id}
                  product={product}
                  slug={slug}
                  store={store}
                  cardStyle={cardStyle}
                  index={idx}
                  priority={groupIndex === 0 && idx < 4}
                  deferOffscreen={false}
                />
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}

export default function BrandCarouselGroups({ products, slug, store, cardStyle = "style-1" }: Props) {
  const groups = useMemo(() => groupSaleProductsByBrand(products), [products]);

  if (groups.length === 0) return null;

  return (
    <div className="space-y-6">
      {groups.map((group, gi) => (
        <BrandRail
          key={group.key}
          group={group}
          groupIndex={gi}
          products={products}
          slug={slug}
          store={store}
          cardStyle={cardStyle}
        />
      ))}
    </div>
  );
}
