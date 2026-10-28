/**
 * BrandCarouselGroups — brand-grouped horizontal carousels for a single
 * category page (Utkal Watch → /category/sale).
 *
 * Perf notes:
 *  - No embla / autoplay / extra deps: plain CSS scroll-snap row. Zero JS on
 *    scroll, so cold-load cost over the normal grid is ~0.
 *  - Rendered through React.lazy from CategoryDetail and only for the one
 *    store+category that opts in, so every other storefront ships nothing.
 *  - Mobile shows 2 cards + a clear peek of the third (43% basis), a pulsing
 *    arrow, a "Swipe" header chip, a progress bar and a one-time nudge so the
 *    row reads as swipeable. All transform-only; no scroll-jacking.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
    // Owner request: show each brand row in reverse of the loaded order.
    if (items.length) out.push({ key: brand.key, label: brand.label, items: items.reverse() });
  }
  const rest = products.filter((p) => !used.has(p.id));
  if (rest.length) out.push({ key: "more", label: "More Watches", items: rest.reverse() });
  return out;
}

interface BrandRailProps extends Props {
  group: { key: string; label: string; items: any[] };
  groupIndex: number;
  /** Real card height measured by any mounted rail (0 until known). */
  cardHeight: number;
  onCardHeight: (h: number) => void;
}

/**
 * Mount each rail only when it approaches the viewport, then reveal more cards
 * as the shopper scrolls horizontally. Native image lazy-loading alone starts
 * downloads several screens early, which previously fetched the whole Sale
 * collection during the first load.
 */
function BrandRail({ group, groupIndex, slug, store, cardStyle, cardHeight, onCardHeight }: BrandRailProps) {
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
  const totalCols = Math.ceil(group.items.length / 2);

  const railRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef(0);
  const touchedRef = useRef(false);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const [nudge, setNudge] = useState(false);

  const revealMore = () => {
    if (hasMore) setVisibleCount((count) => Math.min(count + 8, group.items.length));
  };

  /** Column width + gap, measured from the first two columns. */
  const colStep = (rail: HTMLDivElement) => {
    const a = rail.children[0] as HTMLElement | undefined;
    const b = rail.children[1] as HTMLElement | undefined;
    if (!a) return rail.clientWidth / 2;
    return b ? b.offsetLeft - a.offsetLeft : a.offsetWidth;
  };

  // Progress thumb + arrow visibility. Thumb is written straight to the DOM
  // (transform only), state flips only when start/end actually change.
  const syncIndicators = () => {
    const rail = railRef.current;
    if (!rail) return;
    const step = colStep(rail);
    const fullWidth = step * totalCols;
    const ratio = Math.min(1, rail.clientWidth / Math.max(fullWidth, 1));
    const maxScroll = Math.max(fullWidth - rail.clientWidth, 1);
    const progress = Math.min(1, rail.scrollLeft / maxScroll);
    if (thumbRef.current) {
      thumbRef.current.style.width = `${Math.max(ratio * 100, 12)}%`;
      thumbRef.current.style.transform = `translateX(${progress * (100 / Math.max(ratio, 0.12) - 100)}%)`;
    }
    const start = rail.scrollLeft < 8;
    const end = !hasMore && rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 8;
    setAtStart((v) => (v === start ? v : start));
    setAtEnd((v) => (v === end ? v : end));
  };

  useEffect(() => {
    syncIndicators();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleItems.length, isNearViewport]);

  useEffect(() => () => cancelAnimationFrame(frameRef.current), []);

  // Placeholder cards (not yet activated, further right) are taller than real
  // cards; they set the shared row height and leave a blank band under the
  // rail. Measure the first real card and size placeholders to match.
  useEffect(() => {
    const rail = railRef.current;
    const first = rail?.children[0]?.children[0] as HTMLElement | undefined;
    if (!rail || !first || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      if (!first.classList.contains("prepared-product-card")) return;
      const h = Math.round(first.getBoundingClientRect().height);
      if (h > 0) {
        rail.style.setProperty("--brand-card-h", `${h}px`);
        onCardHeight(h);
      }
    });
    observer.observe(first);
    return () => observer.disconnect();
  }, [isNearViewport, visibleItems.length > 0]);

  // One gentle "there's more →" nudge the first time the rail is properly on
  // screen. Transform-only CSS animation on the cards, skipped once touched
  // and for shoppers who prefer reduced motion.
  useEffect(() => {
    if (!isNearViewport || totalCols <= 2) return;
    const rail = railRef.current;
    if (!rail || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let timer = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        timer = window.setTimeout(() => {
          if (!touchedRef.current && (railRef.current?.scrollLeft ?? 0) < 8) setNudge(true);
        }, 450);
      },
      { threshold: 0.6 }
    );
    observer.observe(rail);
    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, [isNearViewport, totalCols]);

  const scrollByPage = (dir: 1 | -1) => {
    const rail = railRef.current;
    if (!rail) return;
    touchedRef.current = true;
    setNudge(false);
    const step = colStep(rail);
    const cols = Math.max(1, Math.floor(rail.clientWidth / step));
    revealMore();
    // Land exactly on a column start so snap never pulls the row back.
    const current = Math.round(rail.scrollLeft / step);
    rail.scrollTo({ left: Math.max(0, (current + dir * cols) * step), behavior: "smooth" });
  };

  const textColor = "var(--storefront-text, hsl(var(--foreground)))";
  const showIndicators = isNearViewport && totalCols > 2;

  return (
    <section ref={sectionRef}>
      <div className="mb-2 flex items-center justify-between gap-2 px-0.5">
        <h2 className="text-[15px] sm:text-lg font-semibold tracking-tight" style={{ color: textColor }}>
          {group.label}
        </h2>
        {totalCols > 2 ? (
          <button
            type="button"
            onClick={() => scrollByPage(1)}
            className="flex h-7 shrink-0 items-center gap-1 rounded-full border px-2.5 text-[11px] font-medium"
            style={{ color: textColor, borderColor: "color-mix(in srgb, currentColor 22%, transparent)" }}
            aria-label={`See more ${group.label} watches`}
          >
            <span className="opacity-70">{group.items.length} watches</span>
            <span className="font-semibold">· Swipe</span>
            <ChevronRight className="brand-rail-arrow-hint h-3.5 w-3.5" aria-hidden />
          </button>
        ) : (
          <span className="flex h-7 items-center text-[11px] opacity-60" style={{ color: textColor }}>
            {group.items.length} {group.items.length === 1 ? "watch" : "watches"}
          </span>
        )}
      </div>

      <div className="relative -mx-3 sm:mx-0">
        <div
          ref={railRef}
          className={`brand-rail grid grid-flow-col grid-rows-1 items-start auto-cols-[43%] snap-x snap-mandatory gap-x-1 overflow-x-auto scroll-px-1.5 px-1.5 pb-1 scrollbar-hide sm:auto-cols-[32.5%] sm:gap-x-1.5 sm:px-0 sm:scroll-px-0 md:auto-cols-[24.5%] lg:auto-cols-[19.6%]${nudge ? " brand-rail-nudge" : ""}`}
          style={{
            overscrollBehaviorX: "contain",
            WebkitOverflowScrolling: "touch",
            // Reserve space only while a below-fold rail is deferred. Keeping a
            // fixed 620px height after cards mount stretches the two grid rows
            // and creates a large blank band between them on mobile.
            // Once a real card has been measured, reserve exactly two rows so
            // mounting a rail never moves the rails below it.
            minHeight: isNearViewport ? undefined : cardHeight > 0 ? (group.items.length > 1 ? cardHeight * 2 + 4 : cardHeight) + 4 : 620,
          }}
          onTouchStart={() => {
            touchedRef.current = true;
          }}
          onAnimationEnd={(e) => { if (e.animationName === "brand-rail-nudge") setNudge(false); }}
          onScroll={(event) => {
            const rail = event.currentTarget;
            if (hasMore && rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - rail.clientWidth * 0.75) revealMore();
            cancelAnimationFrame(frameRef.current);
            frameRef.current = requestAnimationFrame(syncIndicators);
          }}
        >
          {/* Each column stacks its own two cards, so a taller card further along
              the rail can never stretch a shared row and open a gap. */}
          {Array.from({ length: Math.ceil(visibleItems.length / 2) }, (_, col) => (
            <div key={visibleItems[col * 2].id} className="flex snap-start flex-col gap-1">
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

        {showIndicators && !atStart && (
          <button
            type="button"
            onClick={() => scrollByPage(-1)}
            className="brand-rail-btn absolute left-1.5 top-[28%] z-[2] -translate-y-1/2"
            aria-label={`Previous ${group.label} watches`}
          >
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>
        )}
        {showIndicators && !atEnd && (
          <button
            type="button"
            onClick={() => scrollByPage(1)}
            className="brand-rail-btn brand-rail-btn-pulse absolute right-1.5 top-[28%] z-[2] -translate-y-1/2"
            aria-label={`More ${group.label} watches`}
          >
            <ChevronRight className="h-5 w-5" aria-hidden />
          </button>
        )}
      </div>

      {/* Section footer: two hairlines fading outward with the scroll gauge
          (or a small diamond on short rails) riding in the middle. */}
      <div className="brand-rail-gauge" aria-hidden>
        <div className="brand-rail-gauge-rule brand-rail-gauge-rule-l" />
        {totalCols > 2 ? (
          <div className="brand-rail-gauge-track">
            <div ref={thumbRef} className="brand-rail-gauge-fill" style={{ width: "30%" }} />
          </div>
        ) : (
          <div className="brand-rail-gauge-ornament" />
        )}
        <div className="brand-rail-gauge-rule brand-rail-gauge-rule-r" />
      </div>

    </section>
  );
}

/**
 * Pin the owner's opening brands, then retain first-seen order for the rest.
 * This only orders sections; product order and photo activation stay unchanged.
 */
const OPENING_BRANDS = ["seiko", "hublot", "fossil", "rolex", "patek-philippe"];
export function stableGroupOrder<T extends { key: string }>(groups: T[], seen: string[]): T[] {
  for (const g of groups) if (g.key !== "more" && !seen.includes(g.key)) seen.push(g.key);
  const rank = (k: string) => {
    if (k === "more") return Number.MAX_SAFE_INTEGER;
    const openingIndex = OPENING_BRANDS.indexOf(k);
    return openingIndex >= 0 ? openingIndex : OPENING_BRANDS.length + seen.indexOf(k);
  };
  return [...groups].sort((a, b) => rank(a.key) - rank(b.key));
}

export default function BrandCarouselGroups({ products, slug, store, cardStyle = "style-1" }: Props) {
  const seenOrder = useRef<string[]>([]);
  const [cardHeight, setCardHeight] = useState(0);
  const groups = useMemo(() => stableGroupOrder(groupSaleProductsByBrand(products), seenOrder.current), [products]);

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
          cardHeight={cardHeight}
          onCardHeight={setCardHeight}
        />
      ))}
    </div>
  );
}
