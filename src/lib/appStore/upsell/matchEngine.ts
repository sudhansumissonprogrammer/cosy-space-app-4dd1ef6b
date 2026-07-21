import type {
  UpsellOffer,
  UpsellPlacement,
  UpsellIncentive,
} from "./types";

/** Runtime cart signal fed into the engine (kept intentionally loose). */
export interface UpsellCartSignal {
  productIds: string[];
  categoryIds?: string[];
  totalValue: number;
  totalQty: number;
}

export interface UpsellContext {
  placement: UpsellPlacement;
  triggerProductId?: string;      // PDP anchor
  triggerCategoryId?: string;     // PDP category
  cart: UpsellCartSignal;
  now?: Date;
}

/** Return active offers matching a placement + context, highest priority first. */
export function matchOffers(
  offers: UpsellOffer[],
  ctx: UpsellContext
): UpsellOffer[] {
  const now = (ctx.now ?? new Date()).getTime();
  return (offers || [])
    .filter((o) => {
      if (!o?.active) return false;
      if (!o.placements?.includes(ctx.placement)) return false;
      if (o.starts_at) {
        const t = new Date(o.starts_at).getTime();
        if (!Number.isNaN(t) && t > now) return false;
      }
      if (o.ends_at) {
        const t = new Date(o.ends_at).getTime();
        if (!Number.isNaN(t) && t < now) return false;
      }

      const t = o.trigger || { type: "any" };
      switch (t.type) {
        case "any":
          return true;
        case "product": {
          const ids = new Set(t.product_ids || []);
          if (ctx.triggerProductId && ids.has(ctx.triggerProductId)) return true;
          return ctx.cart.productIds.some((id) => ids.has(id));
        }
        case "category": {
          const ids = new Set(t.category_ids || []);
          if (ctx.triggerCategoryId && ids.has(ctx.triggerCategoryId)) return true;
          return (ctx.cart.categoryIds || []).some((id) => ids.has(id));
        }
        case "cart_value":
          return ctx.cart.totalValue >= (t.min_cart_value || 0);
        case "cart_qty":
          return ctx.cart.totalQty >= (t.min_qty || 0);
        default:
          return false;
      }
    })
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
}

/** Compute the incentive-adjusted unit price. Server MUST re-derive; this is UI-only. */
export function applyIncentivePreview(
  unitPrice: number,
  incentive?: UpsellIncentive
): number {
  if (!incentive || incentive.type === "none") return unitPrice;
  if (incentive.type === "percent_off") {
    const v = Math.max(0, Math.min(100, Number(incentive.value) || 0));
    return Math.max(0, Math.round(unitPrice * (100 - v)) / 100);
  }
  if (incentive.type === "flat_off") {
    return Math.max(0, unitPrice - (Number(incentive.value) || 0));
  }
  if (incentive.type === "free_gift") return 0;
  return unitPrice;
}