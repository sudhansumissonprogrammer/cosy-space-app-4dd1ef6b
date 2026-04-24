import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import UniversalProductCard from "@/components/storefront/UniversalProductCard";
import { VariantCountProvider } from "@/hooks/useVariantCounts";
import { useStorefrontThemeConfig } from "@/hooks/useStorefrontThemeConfig";
import type { Tables } from "@/integrations/supabase/types";

interface Props {
  storeId: string;
  storeSlug: string;
  currentProductId: string;
  currentCategory: string | null;
  store: Tables<"stores">;
  addToCart: (item: any) => void;
  currency: string;
}

export default function RelatedProducts({
  storeId,
  storeSlug,
  currentProductId,
  currentCategory,
  store,
}: Props) {
  const themeConfig = useStorefrontThemeConfig(storeId);
  const cardStyle = themeConfig?.product_card_style || "style-1";

  const { data: related } = useQuery({
    queryKey: ["related-products", storeId, currentProductId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("store_id", storeId)
        .eq("is_active", true)
        .neq("id", currentProductId)
        .limit(8);
      if (error) throw error;

      if (currentCategory && data.length > 4) {
        const sameCategory = data.filter((p) => p.category === currentCategory);
        const otherCategory = data.filter((p) => p.category !== currentCategory);
        return [...sameCategory, ...otherCategory].slice(0, 4);
      }
      return data.slice(0, 4);
    },
    enabled: !!storeId && !!currentProductId,
    staleTime: 5 * 60 * 1000,
  });

  if (!related || related.length === 0) return null;

  const productIds = related.map((p) => p.id);

  return (
    <VariantCountProvider productIds={productIds}>
      <section className="mt-10 pt-8 border-t border-border">
        <h2 className="text-lg font-bold text-foreground mb-4">Complete the Look ✨</h2>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
          {related.map((product, i) => (
            <UniversalProductCard key={product.id} product={product} slug={storeSlug} store={store} cardStyle={cardStyle} index={i} />
          ))}
        </div>
      </section>
    </VariantCountProvider>
  );
}
