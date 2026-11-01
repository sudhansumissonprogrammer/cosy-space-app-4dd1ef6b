/**
 * PDP wrapper that fetches upsell offers, matches them to the current
 * product context, and renders <UpsellStrip placement="pdp"> when any
 * offer applies.
 */
import { lazy, Suspense, useMemo } from "react";
import { useUpsellOffers } from "@/hooks/useUpsellOffers";
import { matchOffers } from "@/lib/appStore/upsell/matchEngine";
const UpsellStrip = lazy(() => import("./UpsellStrip"));

interface Props {
  storeSlug: string;
  storeId: string;
  currency: string;
  productId: string;
  categoryId?: string;
  price: number;
}

export default function PdpUpsellSection({
  storeSlug,
  storeId,
  currency,
  productId,
  categoryId,
  price,
}: Props) {
  const { data: all } = useUpsellOffers(storeSlug);
  const offers = useMemo(() => {
    if (!all?.length) return [];
    return matchOffers(all, {
      placement: "pdp",
      triggerProductId: productId,
      triggerCategoryId: categoryId,
      cart: {
        productIds: [productId],
        categoryIds: categoryId ? [categoryId] : [],
        totalValue: price,
        totalQty: 1,
      },
    });
  }, [all, productId, categoryId, price]);

  if (!offers.length) return null;
  return (
    <div className="mt-6">
      <Suspense fallback={null}>
      <UpsellStrip
        storeId={storeId}
        currency={currency}
        offers={offers}
        placement="pdp"
        excludeProductIds={[productId]}
        triggerCategoryId={categoryId}
      />
      </Suspense>
    </div>
  );
}
