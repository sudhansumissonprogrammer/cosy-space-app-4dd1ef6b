import { useOutletContext, useParams, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useStorefrontThemeConfig } from "@/hooks/useStorefrontThemeConfig";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import UniversalProductCard from "@/components/storefront/UniversalProductCard";
import type { StoreData } from "@/layouts/StorefrontLayout";
import { storefrontPath } from "@/lib/subdomain";

function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl" style={{ backgroundColor: "var(--storefront-bg, hsl(var(--card)))", border: "1px solid color-mix(in srgb, var(--storefront-text, hsl(var(--border))) 12%, transparent)" }}>
      <Skeleton className="w-full" style={{ aspectRatio: "4/5" }} />
      <div className="px-2.5 pb-2.5 pt-2 space-y-2">
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-9 w-full rounded-lg" />
      </div>
    </div>
  );
}

export default function StorefrontBestSellers() {
  const store = useOutletContext<StoreData>();
  const { slug } = useParams<{ slug: string }>();
  const queryClient = useQueryClient();
  const themeConfig = useStorefrontThemeConfig(store.id);
  const cardStyle = themeConfig?.product_card_style || "style-1";

  // Show all products for themes that use Shop as full catalog
  const showAll = ["theme-10", "theme-12"].includes(store.theme);

  const { data: products, isLoading } = useQuery({
    queryKey: showAll ? ["storefront-shop-all", store.id] : ["storefront-best-sellers", store.id],
    queryFn: async () => {
      let query = supabase
        .from("products")
        .select("*, product_images(id, image_url, display_order), product_variants(id, name, price, sku, stock_quantity, display_order)")
        .eq("store_id", store.id)
        .eq("is_active", true);

      if (!showAll) {
        query = query.eq("is_best_selling", true);
      }

      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!store.id,
    staleTime: 5 * 60 * 1000,
  });

  const pageTitle = showAll ? "Shop All" : "🔥 Best Sellers";

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-5 flex items-center gap-3">
        <Link
          to={storefrontPath(slug!, "")}
          className="flex h-8 w-8 items-center justify-center rounded-full transition-colors"
          style={{ backgroundColor: "var(--storefront-bg, hsl(var(--card)))", border: "1px solid color-mix(in srgb, var(--storefront-text, hsl(var(--border))) 12%, transparent)" }}
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-xl font-bold" style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }}>{pageTitle}</h1>
        {products && (
          <span className="text-sm" style={{ color: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 50%, transparent)" }}>({products.length} products)</span>
        )}
      </div>

      {isLoading || !products ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      ) : products && products.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
          {products.map((product, index) => (
            <UniversalProductCard
              key={product.id}
              product={product}
              slug={slug!}
              store={store}
              priority={index < 4}
              cardStyle={cardStyle}
            />
          ))}
        </div>
      ) : (
        <div className="flex min-h-[200px] items-center justify-center rounded-lg" style={{ backgroundColor: "var(--storefront-bg, hsl(var(--card)))", border: "1px solid color-mix(in srgb, var(--storefront-text, hsl(var(--border))) 12%, transparent)" }}>
          <p style={{ color: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 50%, transparent)" }}>No products yet.</p>
        </div>
      )}
    </div>
  );
}
