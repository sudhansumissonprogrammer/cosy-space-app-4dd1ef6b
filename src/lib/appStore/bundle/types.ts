/**
 * Bundle Builder app — types.
 * Bundles are stored inside store_apps.config.bundles (no dedicated table),
 * so this add-on is fully additive and extracts cleanly to main ShopBanao.
 *
 * v2 (2026-07-12): supports 3 bundle types — all fields are additive and
 * optional so legacy `pick_n` bundles keep working unchanged.
 *   - "pick_n"  Pick N from a pool for a flat price          (v1)
 *   - "fixed"   Curated combo of exact products (all-in-one)  (v2)
 *   - "fbt"     Frequently Bought Together on PDP             (v2)
 */

/** Bundle presentation + pricing model. */
export type BundleType = "pick_n" | "fixed" | "fbt";

/** How the combo total is computed from children. */
export type BundleDiscountMode = "flat" | "percent_off" | "amount_off";

export interface BundleDef {
  id: string;
  slug: string;
  name: string;
  subheading?: string;
  banner_url?: string;

  /** v2 type (default "pick_n" if missing). */
  type?: BundleType;
  /** Discount model (default "flat"). Only used for "fixed" and "fbt".
   *  "pick_n" always uses flat `bundle_price`. */
  discount_mode?: BundleDiscountMode;
  /** Percent off MRP total, 1-99. Used when discount_mode === "percent_off". */
  discount_percent?: number;
  /** Flat amount off MRP total. Used when discount_mode === "amount_off". */
  discount_amount?: number;

  /** For "fixed": exact ordered child product ids. */
  fixed_children?: string[];

  /** For "fbt": PDPs on which this strip appears. */
  fbt_anchor_product_ids?: string[];
  /** For "fbt": companion product ids offered next to each anchor. */
  fbt_companion_product_ids?: string[];

  // --- pick_n fields (unchanged) ---
  pick_count: number;
  bundle_price: number;
  include_categories: string[];   // category names/slugs — empty = all categories
  include_product_ids: string[];  // additional manual products
  exclude_product_ids: string[];  // products to hide from the pool

  is_active: boolean;
  sort_order: number;
}

export interface BundleAppConfig {
  bundles: BundleDef[];
}

export const BUNDLE_APP_ID = "bundle-builder";

export const DEFAULT_BUNDLE_CONFIG: BundleAppConfig = { bundles: [] };

/** Sticky-bar cart child (for cart line-item meta). */
export interface BundleChild {
  productId: string;
  name: string;
  image?: string;
  slug?: string;
}

export interface BundleCartMeta {
  kind: "bundle";
  bundle_id: string;
  bundle_slug: string;
  pick_count: number;
  children: BundleChild[];
  /** v2: snapshot of the bundle type so cart/checkout UI can label lines. */
  bundle_type?: BundleType;
}

export function slugifyBundleName(name: string): string {
  return (name || "bundle")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "bundle";
}

/** Effective bundle type (backward-compat default). */
export function bundleTypeOf(b: Pick<BundleDef, "type">): BundleType {
  return (b?.type as BundleType) || "pick_n";
}