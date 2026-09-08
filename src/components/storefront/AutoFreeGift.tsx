/**
 * Automatic free-gift line.
 *
 * Driven entirely by the Upsell app config (`store_apps.config.offers`), so it
 * works for any store without hardcoding: an offer qualifies for auto-add when
 *   incentive.type === "free_gift"
 *   recommend.mode  === "manual" (with at least one product id)
 *   trigger.type    === "cart_value" (min_cart_value)
 *
 * When the cart subtotal of PAID lines reaches the threshold the gift product
 * is added at ₹0; when the cart drops below it the gift line is removed again.
 * The server (place-order) re-derives the ₹0 price AND re-checks the threshold,
 * so this component is a UI convenience only — it cannot be abused.
 */
import { useEffect, useMemo } from "react";
import { useCart } from "@/contexts/CartContext";
import { useUpsellOffers } from "@/hooks/useUpsellOffers";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { UpsellOffer } from "@/lib/appStore/upsell/types";

function pickAutoGiftOffer(offers: UpsellOffer[] | undefined): UpsellOffer | null {
  const list = (offers || []).filter(
    (o) =>
      o?.active !== false &&
      o?.incentive?.type === "free_gift" &&
      o?.trigger?.type === "cart_value" &&
      Number(o?.trigger?.min_cart_value) > 0 &&
      (o?.recommend?.product_ids?.length ?? 0) > 0
  );
  // Highest threshold wins if a store ever configures several tiers.
  return list.sort(
    (a, b) => Number(b.trigger.min_cart_value) - Number(a.trigger.min_cart_value)
  )[0] ?? null;
}

export default function AutoFreeGift({ storeSlug }: { storeSlug: string }) {
  const { items, syncGiftLine } = useCart();
  const { data: offers } = useUpsellOffers(storeSlug);
  const offer = useMemo(() => pickAutoGiftOffer(offers), [offers]);
  const giftId = offer?.recommend?.product_ids?.[0];
  const threshold = Number(offer?.trigger?.min_cart_value || 0);

  const { data: giftLine } = useQuery({
    queryKey: ["auto-free-gift-product", giftId],
    enabled: !!giftId,
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

  // Subtotal of paid lines only — the ₹0 gift must never keep itself alive.
  const paidSubtotal = useMemo(
    () =>
      items
        .filter((i) => !(i.meta?.kind === "upsell" && i.meta?.auto_gift === true))
        .reduce((s, i) => s + i.price * i.quantity, 0),
    [items]
  );

  useEffect(() => {
    if (!offer || !giftId || !giftLine || threshold <= 0) return;
    if (paidSubtotal >= threshold) {
      syncGiftLine(giftId, {
        productId: giftId,
        name: giftLine.name,
        price: 0,
        quantity: 1,
        image: giftLine.image_url || undefined,
        meta: {
          kind: "upsell",
          auto_gift: true,
          offer_id: offer.id,
          placement: "cart_page",
          incentive_snapshot: offer.incentive,
        },
      });
    } else {
      syncGiftLine(giftId, null);
    }
  }, [offer, giftId, giftLine, threshold, paidSubtotal, syncGiftLine]);

  // Safety: if the offer disappears (app disabled), drop any stale gift line.
  useEffect(() => {
    if (offer || !items.length) return;
    const stale = items.find((i) => i.meta?.kind === "upsell" && i.meta?.auto_gift === true);
    if (stale) syncGiftLine(stale.productId, null);
  }, [offer, items, syncGiftLine]);

  return null;
}
