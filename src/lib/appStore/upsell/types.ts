/**
 * Upsell & Cross-sell app — types.
 * Offers live inside `store_apps.config.offers` (no dedicated table) so the
 * add-on stays fully additive and extracts cleanly to main ShopBanao.
 *
 * Placements (surfaces): pdp | cart_drawer | cart_page | pre_checkout | post_purchase
 * Strategies (what to recommend): manual | auto_frequently_bought | auto_same_category | auto_best_sellers | auto_ai
 * Incentive (optional discount): none | percent_off | flat_off | free_gift
 */

export const UPSELL_APP_ID = "upsell-crosssell";

export type UpsellPlacement =
  | "pdp"
  | "cart_drawer"
  | "cart_page"
  | "pre_checkout"
  | "post_purchase";

export type UpsellTriggerType =
  | "any"
  | "product"
  | "category"
  | "cart_value"
  | "cart_qty";

export type UpsellStrategy =
  | "manual"
  | "auto_frequently_bought"
  | "auto_same_category"
  | "auto_best_sellers"
  | "auto_ai";

export type UpsellIncentiveType = "none" | "percent_off" | "flat_off" | "free_gift";

export interface UpsellTrigger {
  type: UpsellTriggerType;
  product_ids?: string[];
  category_ids?: string[];
  min_cart_value?: number;
  min_qty?: number;
}

export interface UpsellRecommend {
  mode: UpsellStrategy;
  product_ids?: string[];       // manual mode
  exclude_ids?: string[];
  max_items: number;            // default 4
}

export interface UpsellIncentive {
  type: UpsellIncentiveType;
  value?: number;                                        // percent or flat amount
  applies_to?: "recommended_only" | "whole_cart";
  min_qty?: number;
  stack_with_coupon?: boolean;                           // default false
}

export interface UpsellDisplay {
  title: string;
  subtitle?: string;
  layout?: "strip" | "grid" | "modal" | "one_click_card";
  urgency_countdown_sec?: number;
  low_stock_text?: string;
}

export interface UpsellOffer {
  id: string;
  name: string;
  active: boolean;
  priority: number;
  placements: UpsellPlacement[];
  trigger: UpsellTrigger;
  recommend: UpsellRecommend;
  incentive?: UpsellIncentive;
  display: UpsellDisplay;
  starts_at?: string | null;
  ends_at?: string | null;
  max_per_customer?: number;
}

export interface UpsellAppConfig {
  offers: UpsellOffer[];
}

export const DEFAULT_UPSELL_CONFIG: UpsellAppConfig = { offers: [] };

export function newUpsellOffer(priority: number): UpsellOffer {
  return {
    id: crypto.randomUUID(),
    name: "",
    active: true,
    priority,
    placements: ["cart_page"],
    trigger: { type: "any" },
    recommend: { mode: "auto_best_sellers", max_items: 4, exclude_ids: [] },
    display: { title: "You may also like", layout: "strip" },
  };
}

/** Cart-line meta for an upsell-added item. */
export interface UpsellCartMeta {
  kind: "upsell";
  offer_id: string;
  placement: UpsellPlacement;
  incentive_snapshot?: UpsellIncentive;
}