import { useEffect, useState } from "react";
import { ArrowDownAZ, ArrowUpAZ, IndianRupee, BadgePercent, PackageCheck, Filter } from "lucide-react";

export type SortKey = "default" | "price-asc" | "price-desc" | "discount" | "in-stock";

interface ShopFilterBarProps {
  total: number;
  showing: number;
  sort: SortKey;
  onSortChange: (s: SortKey) => void;
  /** offset from top (header height); default 0 */
  topOffset?: number;
}

const PILLS: { key: SortKey; label: string; icon: any }[] = [
  { key: "default", label: "Sort", icon: Filter },
  { key: "price-asc", label: "Price: Low", icon: ArrowDownAZ },
  { key: "price-desc", label: "Price: High", icon: ArrowUpAZ },
  { key: "discount", label: "Discount", icon: BadgePercent },
  { key: "in-stock", label: "In Stock", icon: PackageCheck },
];

/** Sticky filter/sort pill bar with result count. Zero new network calls. */
export default function ShopFilterBar({ total, showing, sort, onSortChange, topOffset = 0 }: ShopFilterBarProps) {
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 80);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className={`sticky z-30 -mx-3 sm:-mx-4 lg:-mx-6 px-3 sm:px-4 lg:px-6 py-2 transition-shadow ${stuck ? "shadow-sm" : ""}`}
      style={{ top: topOffset, background: "var(--storefront-bg, hsl(var(--background)))" }}
    >
      <div className="flex items-center gap-2">
        <div className="text-[11px] font-semibold text-muted-foreground whitespace-nowrap shrink-0">
          {showing} of {total}
        </div>
        <div className="h-4 w-px bg-border shrink-0" />
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mr-3 sm:-mr-4 lg:-mr-6 pr-3 sm:pr-4 lg:pr-6">
          {PILLS.map((p) => {
            const active = sort === p.key;
            const Icon = p.icon;
            return (
              <button
                key={p.key}
                onClick={() => onSortChange(active && p.key !== "default" ? "default" : p.key)}
                className={`shrink-0 inline-flex items-center gap-1.5 px-3 h-8 rounded-full text-[12px] font-semibold transition-colors border ${
                  active
                    ? "bg-foreground text-background border-foreground"
                    : "bg-card text-foreground border-border hover:bg-accent"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {p.label}
              </button>
            );
          })}
        </div>
      </div>
      <style>{`.no-scrollbar::-webkit-scrollbar{display:none}.no-scrollbar{scrollbar-width:none}`}</style>
    </div>
  );
}

/** Apply sort key to product list. Pure utility — no network calls. */
export function applySort<T extends { price?: number; sale_price?: number | null; stock_quantity?: number | null }>(
  products: T[],
  sort: SortKey
): T[] {
  if (sort === "default") return products;
  const arr = [...products];
  const eff = (p: T) => {
    const sp = p.sale_price ? Number(p.sale_price) : null;
    const bp = Number(p.price || 0);
    return sp && sp < bp ? sp : bp;
  };
  if (sort === "price-asc") arr.sort((a, b) => eff(a) - eff(b));
  if (sort === "price-desc") arr.sort((a, b) => eff(b) - eff(a));
  if (sort === "discount") {
    arr.sort((a, b) => {
      const da = (Number(a.price || 0) - eff(a)) / Math.max(1, Number(a.price || 0));
      const db = (Number(b.price || 0) - eff(b)) / Math.max(1, Number(b.price || 0));
      return db - da;
    });
  }
  if (sort === "in-stock") return arr.filter((p) => Number(p.stock_quantity ?? 1) > 0);
  return arr;
}
