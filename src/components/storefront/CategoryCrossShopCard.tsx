import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { optimizeImageUrl } from "@/lib/imageOptimize";
import { storefrontPath } from "@/lib/subdomain";
import { Skeleton } from "@/components/ui/skeleton";

const SERDIYA_STORE_IDS = new Set([
  "771a3012-393c-421a-b1c9-2ca918e6917f",
  "04010cad-1cbe-40ac-b818-07d9a79c1bf7",
]);

export function isSerdiyaCrossShopCategory(storeId: string, categorySlug?: string) {
  return SERDIYA_STORE_IDS.has(storeId) && (categorySlug === "ring-1" || categorySlug === "chain");
}

type ShortcutProduct = {
  id: string;
  image_url: string | null;
};

export function crossShopTargetSlug(currentCategorySlug: string) {
  return currentCategorySlug === "ring-1" ? "chain" : "ring-1";
}

export function crossShopQueryKey(storeId: string, targetSlug: string) {
  return ["serdiya-category-cross-shop", storeId, targetSlug, "top4"] as const;
}

/** Top 4 products exactly as the target category page orders them (pins first). */
export async function fetchCrossShopProducts(storeId: string, targetSlug: string): Promise<ShortcutProduct[]> {
  const { data, error } = await (supabase as any).rpc("get_category_products_page_by_slug", {
    _store_id: storeId,
    _category_slug: targetSlug,
    _offset: 0,
    _limit: 8,
  });
  if (error) throw error;
  const rows = ((data as any[]) || []).filter((p) => p?.image_url).slice(0, 4);
  const items = rows.map((p) => ({ id: String(p.id), image_url: p.image_url as string }));
  if (typeof window !== "undefined") {
    // Start photo downloads the moment the list arrives, before the card renders.
    for (const p of items) { const img = new Image(); img.decoding = "async"; img.src = optimizeImageUrl(p.image_url!, 300, 80); }
  }
  return items;
}

interface CategoryCrossShopCardProps {
  storeId: string;
  storeSlug: string;
  currentCategorySlug: string;
  active: boolean;
}

export default function CategoryCrossShopCard({
  storeId,
  storeSlug,
  currentCategorySlug,
  active,
}: CategoryCrossShopCardProps) {
  const target = currentCategorySlug === "ring-1"
    ? { name: "chain", slug: "chain", label: "Chains", action: "Shop Chains" }
    : { name: "Ring-1", slug: "ring-1", label: "Rings", action: "Shop Rings" };

  const { data: products = [], isLoading, isError } = useQuery({
    queryKey: crossShopQueryKey(storeId, target.slug),
    queryFn: () => fetchCrossShopProducts(storeId, target.slug),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: active,
  });

  return (
    <Link
      to={storefrontPath(storeSlug, `category/${target.slug}`)}
      className="card-tilt group relative overflow-hidden rounded-2xl transition-[transform,opacity,colors,box-shadow] duration-300 ease-out md:hidden"
      style={{
        backgroundColor: "var(--storefront-bg, hsl(var(--card)))",
        border: "1px solid color-mix(in srgb, var(--storefront-text, hsl(var(--border))) 10%, transparent)",
        boxShadow: "0 4px 14px color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 9%, transparent)",
      }}
      aria-label={target.action}
    >
      <div className="block p-1 pb-0">
        <div
          className="relative grid w-full grid-cols-2 grid-rows-2 gap-px overflow-hidden rounded-xl bg-muted"
          style={{ aspectRatio: "3 / 4" }}
        >
          {Array.from({ length: 4 }).map((_, index) => {
            const product = products[index];
            // Each photo paints as soon as it arrives (like product cards), instead of
            // waiting for all four to finish downloading.
            return product?.image_url ? (
              <img
                key={product.id}
                src={optimizeImageUrl(product.image_url, 300, 80)}
                alt=""
                width={300}
                height={400}
                loading="eager"
                decoding="async"
                fetchPriority="high"
                className="h-full w-full bg-muted object-cover"
              />
            ) : isLoading && !isError ? (
              <Skeleton key={index} className="h-full w-full rounded-none" />
            ) : (
              <div key={index} className="h-full w-full bg-muted" aria-hidden="true" />
            );
          })}
        </div>
      </div>

      <div className="space-y-1 px-3 pb-3 pt-2">
        <div
          className="flex items-center justify-between gap-2 border-b pb-1.5"
          style={{ borderColor: "color-mix(in srgb, var(--storefront-text, hsl(var(--border))) 10%, transparent)" }}
        >
          <span className="text-[13px] font-semibold uppercase" style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }}>
            {target.label}
          </span>
          <ArrowRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        </div>
        <div className="h-5" aria-hidden="true" />
        <span
          className="flex h-7 w-full items-center justify-center gap-1.5 rounded-md text-[10px] font-medium uppercase"
          style={{
            backgroundColor: "var(--storefront-primary, hsl(var(--primary)))",
            color: "var(--storefront-btn-text, hsl(var(--primary-foreground)))",
            borderRadius: "var(--storefront-button-radius, 0.375rem)",
          }}
        >
          {target.action}
          <ArrowRight className="h-3 w-3" aria-hidden="true" />
        </span>
      </div>
    </Link>
  );
}