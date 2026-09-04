/**
 * Single source of truth for "what did the customer actually pay?".
 *
 * Orders store only the FINAL `total` (after coupon + prepaid discounts), so
 * every screen that shows a money breakdown must re-derive the discount lines
 * from the item subtotal. Doing this in one place keeps the thank-you screen,
 * the storefront order detail page and the merchant order sheet consistent.
 */

export interface OrderLike {
  total: number | string | null;
  coupon_discount?: number | string | null;
  payment_type?: string | null;
  payment_method?: string | null;
  advance_paid?: number | string | null;
  balance_due?: number | string | null;
  notes?: string | null;
}

export interface OrderBreakdownLine {
  label: string;
  amount: number;
  /** negative = discount line */
  kind: "subtotal" | "discount" | "charge";
}

export interface OrderBreakdown {
  itemsSubtotal: number;
  couponDiscount: number;
  /** Prepaid / any other order-level discount stamped by the server. */
  extraDiscount: number;
  extraDiscountLabel: string;
  /** Shipping + taxes (whatever raises the total above the item subtotal). */
  charges: number;
  total: number;
  /** Money already collected (online / advance). */
  paid: number;
  /** Money the customer still owes at delivery. */
  dueOnDelivery: number;
  isPartial: boolean;
  isCod: boolean;
  lines: OrderBreakdownLine[];
}

const n = (v: unknown) => {
  const x = Number(v ?? 0);
  return Number.isFinite(x) ? x : 0;
};

/**
 * COD detection must be exact. A naive /cod|cash/ substring match treated
 * "cashfree" (an ONLINE gateway) as cash-on-delivery, which made every
 * Cashfree-paid order show "Paid online 0 / Due on delivery <total>".
 */
const ONLINE_GATEWAYS = new Set([
  "cashfree",
  "razorpay",
  "payu",
  "phonepe",
  "paytm",
  "upi",
  "stripe",
  "online",
  "prepaid",
  "card",
  "netbanking",
  "wallet",
]);

export function isCodMethod(method?: string | null) {
  const m = String(method || "").trim().toLowerCase();
  if (!m) return true; // unknown method on a legacy order → assume COD
  if (ONLINE_GATEWAYS.has(m)) return false;
  return /\bcod\b|cash[\s_-]*on[\s_-]*delivery|^cash$/.test(m);
}

export function buildOrderBreakdown(order: OrderLike, itemsSubtotal: number): OrderBreakdown {
  const total = Math.max(0, n(order.total));
  const subtotal = Math.max(0, itemsSubtotal);
  const coupon = Math.max(0, Math.min(n(order.coupon_discount), subtotal));

  const delta = subtotal - coupon - total; // >0 → extra discount, <0 → charges
  const extraDiscount = delta > 0.5 ? Math.round(delta) : 0;
  const charges = delta < -0.5 ? Math.round(-delta) : 0;
  const extraDiscountLabel = /prepaid/i.test(String(order.notes || ""))
    ? "Prepaid discount"
    : "Extra discount";

  const isPartial = String(order.payment_type || "") === "partial";
  const isCod = isCodMethod(order.payment_method);

  let paid = 0;
  let dueOnDelivery = 0;
  if (isPartial) {
    paid = Math.max(0, n(order.advance_paid));
    dueOnDelivery = Math.max(0, order.balance_due != null ? n(order.balance_due) : total - paid);
  } else if (isCod) {
    paid = 0;
    dueOnDelivery = total;
  } else {
    paid = total;
    dueOnDelivery = 0;
  }

  const lines: OrderBreakdownLine[] = [{ label: "Items subtotal", amount: subtotal, kind: "subtotal" }];
  if (coupon > 0) lines.push({ label: "Coupon discount", amount: -coupon, kind: "discount" });
  if (extraDiscount > 0) lines.push({ label: extraDiscountLabel, amount: -extraDiscount, kind: "discount" });
  if (charges > 0) lines.push({ label: "Shipping & charges", amount: charges, kind: "charge" });

  return {
    itemsSubtotal: subtotal,
    couponDiscount: coupon,
    extraDiscount,
    extraDiscountLabel,
    charges,
    total,
    paid,
    dueOnDelivery,
    isPartial,
    isCod,
    lines,
  };
}
