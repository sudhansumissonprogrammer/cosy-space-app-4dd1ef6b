import { useMemo } from "react";
import { VariantCountProvider } from "@/hooks/useVariantCounts";
import { useStorefrontThemeConfig } from "@/hooks/useStorefrontThemeConfig";
import { usePdpCarouselPools } from "@/hooks/usePdpCarouselPools";
import PdpProductCarousel from "./PdpProductCarousel";

interface Props {
  storeId: string;
  storeSlug: string;
  currentProductId: string;
  currentCategory: string | null;
  store: any;
}

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Three deduped product carousels on the PDP:
 *  1. Same category as the open product
 *  2. Best sellers
 *  3. Another category (next in the merchant's category order)
 *
 * Mounted behind DeferUntilVisible + React.lazy on the PDP, so nothing
 * here runs until the shopper scrolls near it — PDP paint is unchanged.
 */
export default function PdpCarousels({
  storeId,
  storeSlug,
  currentProductId,
  currentCategory,
  store,
}: Props) {
  const themeConfig = useStorefrontThemeConfig(storeId);
  const cardStyle = themeConfig?.product_card_style || "style-1";

  const { same, best, other, otherCategory } = usePdpCarouselPools({
    storeId,
    currentProductId,
    currentCategory,
  });

  const allProducts = useMemo(
    () =>
      [...same.items, ...best.items, ...other.items].map((p: any) => ({
        id: p.id,
        has_variants: p.has_variants,
      })),
    [same.items, best.items, other.items],
  );

  if (same.items.length === 0 && best.items.length === 0 && other.items.length === 0) return null;

  return (
    <VariantCountProvider products={allProducts}>
      <div className="mt-8 pt-6 border-t border-border">
        <PdpProductCarousel
          title={currentCategory ? `More in ${titleCase(currentCategory)}` : "Similar products"}
          items={same.items}
          slug={storeSlug}
          store={store}
          cardStyle={cardStyle}
          hasNextPage={same.query.hasNextPage}
          isFetchingNextPage={same.query.isFetchingNextPage}
          fetchNextPage={same.query.fetchNextPage}
        />

        <PdpProductCarousel
          title="Best sellers"
          items={best.items}
          slug={storeSlug}
          store={store}
          cardStyle={cardStyle}
          hasNextPage={best.query.hasNextPage}
          isFetchingNextPage={best.query.isFetchingNextPage}
          fetchNextPage={best.query.fetchNextPage}
        />

        <PdpProductCarousel
          title={otherCategory ? `You may also like — ${titleCase(otherCategory)}` : "You may also like"}
          items={other.items}
          slug={storeSlug}
          store={store}
          cardStyle={cardStyle}
          hasNextPage={other.query.hasNextPage}
          isFetchingNextPage={other.query.isFetchingNextPage}
          fetchNextPage={other.query.fetchNextPage}
        />
      </div>
    </VariantCountProvider>
  );
}
