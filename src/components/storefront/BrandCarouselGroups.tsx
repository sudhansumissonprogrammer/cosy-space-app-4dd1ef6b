/**
 * BrandCarouselGroups — brand-grouped horizontal carousels for a single
 * category page (Utkal Watches → /category/sale).
 *
 * Perf notes:
 *  - No embla / autoplay / extra deps: plain CSS scroll-snap row. Zero JS on
 *    scroll, so cold-load cost over the normal grid is ~0.
 *  - Rendered through React.lazy from CategoryDetail and only for the one
 *    store+category that opts in, so every other storefront ships nothing.
 *  - Mobile shows 2 full cards + a peek of the third (44% basis) so the row
 *    reads as swipeable.
 */
import { useMemo } from "react";
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
  { key: "casio", label: "Casio Illuminator", match: (n) => n.includes("casio") || n.includes("iluminator") || n.includes("illuminator") },
  { key: "tissot", label: "Tissot", match: (n) => n.includes("tisso") },
  { key: "rado", label: "Rado", match: (n) => n.includes("rado") || n.includes("raddo") },
  { key: "fossil", label: "Fossil", match: (n) => n.includes("fossil") || n.includes("fossiil") },
];

const normalize = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

export default function BrandCarouselGroups({ products, slug, store, cardStyle = "style-1" }: Props) {
  const groups = useMemo(() => {
    const used = new Set<string>();
    const out: { key: string; label: string; items: any[] }[] = [];

    for (const brand of BRANDS) {
      const items = products.filter((p) => {
        if (used.has(p.id)) return false;
        const n = normalize(p.name);
        if (!brand.match(n)) return false;
        used.add(p.id);
        return true;
      });
      if (items.length) out.push({ key: brand.key, label: brand.label, items });
    }

    const rest = products.filter((p) => !used.has(p.id));
    if (rest.length) out.push({ key: "more", label: "More Watches", items: rest });
    return out;
  }, [products]);

  if (groups.length === 0) return null;

  return (
    <div className="space-y-6">
      {groups.map((group, gi) => (
        <section key={group.key}>
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
            className="brand-rail -mx-3 flex items-start snap-x snap-mandatory gap-2 overflow-x-auto scroll-px-3 px-3 pb-1 scrollbar-hide sm:mx-0 sm:px-0 sm:scroll-px-0 sm:gap-4"
            style={{ overscrollBehaviorX: "contain", WebkitOverflowScrolling: "touch" }}
          >
            {group.items.map((product, idx) => (
              <div
                key={product.id}
                className="w-[44%] shrink-0 snap-start sm:w-[31%] md:w-[23.5%] lg:w-[19%]"
              >
                <UniversalProductCard
                  product={product}
                  slug={slug}
                  store={store}
                  cardStyle={cardStyle}
                  index={idx}
                  priority={gi === 0 ? idx < 3 : idx < 2}
                  deferOffscreen={false}

                />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
