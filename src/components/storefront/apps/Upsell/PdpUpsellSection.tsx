/**
 * PDP wrapper that fetches upsell offers, matches them to the current
 * product context, and renders <UpsellStrip placement="pdp"> when any
 * offer applies. Kept in its own file so ProductDetail doesn't grow.
 */
import { useMatchedUpsellOffers } from "@/hooks/useUpsellOffers";
import UpsellStrip from "./UpsellStrip";

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
  const offers = useMatchedUpsellOffers(
    storeSlug,
    {
      cartProductIds: [productId],
      cartCategoryIds: categoryId ? [categoryId] : [],
      cartValue: price,
      cartQty: 1,
      triggerProductId: productId,
      triggerCategoryId: categoryId,
    },
    "pdp",
  );
  if (!offers.length) return null;
  return (
    <div className="mt-6">
      <UpsellStrip
        storeId={storeId}
        currency={currency}
        offers={offers}
        placement="pdp"
        excludeProductIds={[productId]}
        triggerCategoryId={categoryId}
      />
    </div>
  );
}
