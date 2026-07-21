/**
 * Bundle Builder — shared pricing engine.
 * Pure functions. Same logic runs client-side (preview) and server-side
 * (place-order re-derive). Keeps the two in lock-step so shoppers never
 * see a preview total that doesn't match the charged total.
 */
import type { BundleDef, BundleDiscountMode } from "./types";

export interface ChildRef {
  productId: string;
  /** MRP price (paise). Server passes canonical DB price; client passes MRP. */
  pricePaise: number;
  /** Optional variantId — reserved for v2 mix-match. */
  variantId?: string | null;
}

export interface PricedChild extends ChildRef {
  /** Final per-unit paise this child should be charged at inside the bundle. */
  finalPaise: number;
}

export interface BundlePricingResult {
  /** Total combo price in paise (sum of finalPaise). */
  totalPaise: number;
  /** MRP total in paise (sum of pricePaise). */
  mrpPaise: number;
  /** Absolute savings in paise (mrp - total, floored at 0). */
  savingsPaise: number;
  /** Priced children rows (same order as input). */
  children: PricedChild[];
}

function toPaise(n: number | undefined | null): number {
  return Math.max(0, Math.round(Number(n || 0) * 100));
}

/**
 * Compute the final per-child paise for a bundle.
 * Splits the combo total across N children paise-safe (last child absorbs
 * rounding remainder) so downstream order_items sum to exactly totalPaise.
 */
export function priceBundle(bundle: BundleDef, children: ChildRef[]): BundlePricingResult {
  const mrpPaise = children.reduce((s, c) => s + Math.max(0, c.pricePaise | 0), 0);
  const mode: BundleDiscountMode =
    (bundle.discount_mode as BundleDiscountMode) ||
    (bundle.type === "pick_n" ? "flat" : "flat");

  let totalPaise = 0;
  if (bundle.type === "fbt" || bundle.type === "fixed") {
    if (mode === "percent_off") {
      const pct = Math.max(0, Math.min(99, Number(bundle.discount_percent || 0)));
      totalPaise = Math.round(mrpPaise * (1 - pct / 100));
    } else if (mode === "amount_off") {
      const off = toPaise(bundle.discount_amount);
      totalPaise = Math.max(0, mrpPaise - off);
    } else {
      // flat
      totalPaise = toPaise(bundle.bundle_price);
    }
  } else {
    // pick_n — always flat
    totalPaise = toPaise(bundle.bundle_price);
  }

  // Split total across N children paise-safe.
  const N = Math.max(1, children.length);
  const base = Math.floor(totalPaise / N);
  const remainder = totalPaise - base * N;
  const priced: PricedChild[] = children.map((c, i) => ({
    ...c,
    finalPaise: base + (i === N - 1 ? remainder : 0),
  }));

  return {
    totalPaise,
    mrpPaise,
    savingsPaise: Math.max(0, mrpPaise - totalPaise),
    children: priced,
  };
}

/** Rupee-formatted preview strings for UI cards. */
export function previewBundleTotals(bundle: BundleDef, children: ChildRef[]) {
  const r = priceBundle(bundle, children);
  const total = r.totalPaise / 100;
  const mrp = r.mrpPaise / 100;
  const savings = r.savingsPaise / 100;
  const pctOff = r.mrpPaise > 0 ? Math.round((r.savingsPaise / r.mrpPaise) * 100) : 0;
  return { total, mrp, savings, pctOff };
}