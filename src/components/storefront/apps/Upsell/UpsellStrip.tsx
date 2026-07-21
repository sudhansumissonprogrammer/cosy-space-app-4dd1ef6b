/**
 * Shared themed upsell strip.
 * Used for placements: pdp, cart_drawer, cart_page.
 * Reads matched offers, resolves recommended products via a small strategy
 * router, renders a horizontal card strip (or grid on cart_page/layout=grid),
 * fires view/click/add events.
 */
import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Star, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/contexts/CartContext";
import { cleanImageUrl, optimizeImageUrl } from "@/lib/imageOptimize";
import { getDiscountPercent, getProductRating } from "@/lib/productUtils";
import { applyIncentivePreview } from "@/lib/appStore/upsell/matchEngine";
import { trackUpsell } from "@/lib/appStore/upsell/track";
import type {
  UpsellOffer,
  UpsellPlacement,
} from "@/lib/appStore/upsell/types";

interface Props {
  storeId: string;
  currency: string;
  offers: UpsellOffer[];         // pre-matched offers for this placement
  placement: UpsellPlacement;
  excludeProductIds?: string[];  // ids already in cart / current PDP
  /** PDP anchor category — used by `auto_same_category` strategy. */
  triggerCategoryId?: string;
  /** When true, strip is rendered inside a modal — skip the divider header spacing. */
  embedded?: boolean;
}

export default function UpsellStrip({
  storeId,
  currency,
  offers,
  placement,
  excludeProductIds = [],
  triggerCategoryId,
  embedded = false,
}: Props) {
  const { addToCart } = useCart();
  const offer = offers[0]; // highest-priority match (one strip per placement)

  const strategy = offer?.recommend?.mode ?? "auto_best_sellers";
  const manualIds = offer?.recommend?.product_ids ?? [];
  const maxItems = Math.min(Math.max(offer?.recommend?.max_items ?? 4, 1), 12);
  const excludeIds = [...excludeProductIds, ...(offer?.recommend?.exclude_ids ?? [])];

  const { data: products } = useQuery({
    queryKey: [
      "upsell-products",
      storeId,
      offer?.id,
      strategy,
      manualIds.join(","),
      excludeIds.join(","),
      triggerCategoryId || "",
    ],
    enabled: !!storeId && !!offer,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      // Manual mode with 0 picks — return nothing gracefully.
      if (strategy === "manual" && manualIds.length === 0) return [] as any[];
      let query = (supabase as any)
        .from("products")
        .select(
          "id, name, slug, price, sale_price, image_url, is_best_selling, category"
        )
        .eq("store_id", storeId)
        .eq("is_active", true)
        .limit(maxItems + excludeIds.length);

      if (strategy === "manual" && manualIds.length) {
        query = query.in("id", manualIds);
      } else if (strategy === "auto_same_category" && triggerCategoryId) {
        query = query.eq("category", triggerCategoryId).order("is_best_selling", { ascending: false });
      } else {
        // auto_best_sellers fallback (also used until auto_frequently_bought
        // and auto_ai are wired via edge function in Phase 2).
        query = query.order("is_best_selling", { ascending: false });
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const items = useMemo(() => {
    if (!products) return [];
    const excl = new Set(excludeIds);
    return products.filter((p) => !excl.has(p.id)).slice(0, maxItems);
  }, [products, excludeIds, maxItems]);

  // Fire view event once when items render
  useEffect(() => {
    if (!offer || !items.length) return;
    trackUpsell({
      store_id: storeId,
      offer_id: offer.id,
      placement,
      event_type: "view",
    });
  }, [offer, items.length, placement, storeId]);

  if (!offer || items.length === 0) return null;

  const layout = offer.display.layout ?? "strip";
  const isGrid = layout === "grid";

  const handleAdd = (p: any) => {
    const hasSale = p.sale_price && p.sale_price < p.price;
    const basePrice = hasSale ? Number(p.sale_price) : Number(p.price);
    const finalPrice = applyIncentivePreview(basePrice, offer.incentive);

    addToCart({
      productId: p.id,
      name: p.name,
      price: finalPrice,
      image: p.image_url || undefined,
      // Optional cart meta so server can re-derive incentive
      // (place-order treats missing kind as regular line).
      meta: {
        kind: "upsell",
        offer_id: offer.id,
        placement,
        incentive_snapshot: offer.incentive ?? null,
      } as any,
    } as any, {
      // Don't auto-open the cart when user is already inside the cart context
      // (cart page, cart drawer, or pre-checkout modal). PDP still opens the cart
      // for the standard visual feedback.
      silent: placement !== "pdp",
    });

    trackUpsell({
      store_id: storeId,
      offer_id: offer.id,
      placement,
      event_type: "add",
      product_id: p.id,
      revenue_paise: Math.round(finalPrice * 100),
    });
    toast.success(`${p.name} added!`);
  };

  return (
    <section className={embedded ? "" : "mt-4 pt-4 border-t border-border"}>
      <header className="mb-3">
        <h3
          className="text-xs font-bold uppercase tracking-wider"
          style={{
            color:
              "color-mix(in srgb, var(--storefront-text, inherit) 55%, transparent)",
          }}
        >
          {offer.display.title}
        </h3>
        {offer.display.subtitle ? (
          <p
            className="text-[11px] mt-0.5"
            style={{
              color:
                "color-mix(in srgb, var(--storefront-text, inherit) 45%, transparent)",
            }}
          >
            {offer.display.subtitle}
          </p>
        ) : null}
      </header>

      <div
        className={
          isGrid
            ? "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5"
            : "flex gap-2.5 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1"
        }
      >
        {items.map((product) => {
          const hasSale = product.sale_price && product.sale_price < product.price;
          const basePrice = hasSale
            ? Number(product.sale_price)
            : Number(product.price);
          const finalPrice = applyIncentivePreview(basePrice, offer.incentive);
          const showDiscount =
            !!offer.incentive && offer.incentive.type !== "none" && finalPrice < basePrice;
          const rating = getProductRating(product.id);

          return (
            <div
              key={product.id}
              className={
                (isGrid ? "" : "flex-shrink-0 w-[130px] ") +
                "rounded-xl overflow-hidden"
              }
              style={{
                border:
                  "1px solid color-mix(in srgb, var(--storefront-text, inherit) 10%, transparent)",
                backgroundColor:
                  "var(--storefront-bg, hsl(var(--card)))",
              }}
            >
              <div
                className="relative aspect-square w-full"
                style={{
                  backgroundColor:
                    "color-mix(in srgb, var(--storefront-text, inherit) 5%, var(--storefront-bg, #fff))",
                }}
              >
                {product.image_url ? (
                  <img
                    src={optimizeImageUrl(cleanImageUrl(product.image_url), 200)}
                    alt={product.name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                    width={200}
                    height={200}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <ShoppingCart
                      className="h-6 w-6"
                      style={{
                        color:
                          "color-mix(in srgb, var(--storefront-text, inherit) 20%, transparent)",
                      }}
                    />
                  </div>
                )}
                {hasSale ? (
                  <span className="absolute left-1.5 top-1.5 rounded bg-destructive px-1 py-0.5 text-[8px] font-bold text-destructive-foreground">
                    {getDiscountPercent(
                      Number(product.price),
                      Number(product.sale_price)
                    )}
                    % OFF
                  </span>
                ) : null}
                {showDiscount ? (
                  <span className="absolute right-1.5 top-1.5 rounded bg-primary px-1 py-0.5 text-[8px] font-bold text-primary-foreground">
                    OFFER
                  </span>
                ) : null}
              </div>

              <div className="p-2 space-y-1">
                <p
                  className="text-[11px] font-semibold line-clamp-2 leading-tight"
                  style={{ color: "var(--storefront-text, inherit)" }}
                >
                  {product.name}
                </p>
                <div className="flex items-center gap-1">
                  <div className="flex items-center gap-0.5 rounded bg-success px-1 py-0.5">
                    <Star className="h-2 w-2 fill-success-foreground text-success-foreground" />
                    <span className="text-[8px] font-bold text-success-foreground">
                      {rating}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <span
                    className="text-xs font-bold"
                    style={{ color: "var(--storefront-text, inherit)" }}
                  >
                    {currency} {finalPrice.toFixed(0)}
                  </span>
                  {showDiscount ? (
                    <span
                      className="text-[9px] line-through"
                      style={{
                        color:
                          "color-mix(in srgb, var(--storefront-text, inherit) 50%, transparent)",
                      }}
                    >
                      {currency} {basePrice.toFixed(0)}
                    </span>
                  ) : null}
                </div>
                <button
                  onClick={() => {
                    trackUpsell({
                      store_id: storeId,
                      offer_id: offer.id,
                      placement,
                      event_type: "click",
                      product_id: product.id,
                    });
                    handleAdd(product);
                  }}
                  className="flex h-6 w-full items-center justify-center gap-1 rounded-md text-[9px] font-bold uppercase tracking-wide transition-[transform,opacity,colors,box-shadow] active:scale-95"
                  style={{
                    backgroundColor:
                      "var(--storefront-primary, hsl(var(--primary)))",
                    color:
                      "var(--storefront-btn-text, hsl(var(--primary-foreground)))",
                  }}
                >
                  <Plus className="h-3 w-3" strokeWidth={2.5} />
                  Add
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}