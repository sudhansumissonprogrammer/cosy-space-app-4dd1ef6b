/**
 * Auto free-gift line for the CHECKOUT page.
 *
 * `AutoFreeGift` only mutates the cart, so a Buy Now checkout
 * (`/checkout?product=...`) — which builds its items from the URL and never
 * touches the cart — never received the ₹0 gift even when the order value was
 * above the threshold. This hook derives the same gift line from the same
 * Upsell app config so both paths behave identically. The server (place-order)
 * still re-derives the price and re-checks the threshold.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUpsellOffers } from "@/hooks/useUpsellOffers";
import type { UpsellOffer } from "@/lib/appStore/upsell/types";

export interface CheckoutLine {
  productId: string;
  variantId?: string;
  name: string;
  price: number;
  quantity: number;
  image: string | null;
  meta: any;
}

function pickAutoGiftOffer(offers: UpsellOffer[] | undefined): UpsellOffer | null {
  const list = (offers || []).filter(
    (o) =>
      o?.active !== false &&
      o?.incentive?.type === "free_gift" &&
      o?.trigger?.type === "cart_value" &&
      Number(o?.trigger?.min_cart_value) > 0 &&
      (o?.recommend?.product_ids?.length ?? 0) > 0
  );
  return list.sort(
    (a, b) => Number(b.trigger.min_cart_value) - Number(a.trigger.min_cart_value)
  )[0] ?? null;
}

export function useAutoFreeGiftLine(
  storeSlug: string | undefined,
  items: CheckoutLine[]
): CheckoutLine[] {
  const { data: offers } = useUpsellOffers(storeSlug);
  const offer = useMemo(() => pickAutoGiftOffer(offers), [offers]);
  const giftId = offer?.recommend?.product_ids?.[0];
  const threshold = Number(offer?.trigger?.min_cart_value || 0);

  const paidSubtotal = useMemo(
    () =>
      items
        .filter((i) => i.meta?.kind !== "upsell")
        .reduce((s, i) => s + (Number(i.price) || 0) * (Number(i.quantity) || 0), 0),
    [items]
  );

  const qualifies = !!giftId && threshold > 0 && paidSubtotal >= threshold;

  const { data: giftProduct } = useQuery({
    queryKey: ["auto-free-gift-product", giftId],
    enabled: qualifies,
    staleTime: 30 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_checkout_line_item", {
        _product_id: giftId!,
        _variant_id: null,
      });
      if (error) throw error;
      return (data?.product ?? null) as { id: string; name: string; image_url?: string | null } | null;
    },
  });

  return useMemo(() => {
    // Drop any stale gift line first (offer switched off, or cart fell below).
    const base = items.filter((i) => !(i.meta?.kind === "upsell" && i.meta?.auto_gift === true));
    if (!qualifies || !offer || !giftId || !giftProduct) return base;
    if (base.some((i) => i.productId === giftId)) return base; // already bought normally
    return [
      ...base,
      {
        productId: giftId,
        name: giftProduct.name,
        price: 0,
        quantity: 1,
        image: giftProduct.image_url || null,
        meta: {
          kind: "upsell",
          auto_gift: true,
          offer_id: offer.id,
          placement: "pre_checkout",
          incentive_snapshot: offer.incentive,
        },
      },
    ];
  }, [items, qualifies, offer, giftId, giftProduct]);
}
