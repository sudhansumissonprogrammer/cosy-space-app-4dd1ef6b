// Shared helpers for building user-visible content inside WhatsApp templates.
// Kept tiny and dependency-free so both wa-order-event and wa-cart-recovery-cron can use it.

/**
 * Returns an Indian-English expected delivery label, e.g. "Mon, 4 Sep 26".
 * Adds `days` calendar days to `from`, then if it lands on a Sunday pushes to Monday.
 */
export function formatExpectedDelivery(from: Date = new Date(), days = 5): string {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  if (d.getDay() === 0) d.setDate(d.getDate() + 1); // skip Sunday
  // IST-friendly short label. en-IN gives "Mon, 4 Sept 26" — normalize "Sept" → "Sep".
  const label = d.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "2-digit",
    timeZone: "Asia/Kolkata",
  });
  return label.replace(/Sept\b/, "Sep").replace(/\.,/g, ",");
}

/**
 * Builds a clear one-line payment status used inside order_confirmation_v2 / order_shipped_v2.
 * Handles three real cases:
 *   - Fully paid online (Razorpay, UPI, Cashfree, PayU, etc.)
 *   - Partially paid (advance taken; remaining = COD on delivery)
 *   - Pure COD (no advance, full amount collected at delivery)
 */
export type PaymentShape = {
  payment_method?: string | null;
  payment_type?: string | null;
  status?: string | null;
  total?: number | null;
  advance_paid?: number | null;
  balance_due?: number | null;
  currency?: string | null;
};

/**
 * Normalises the money split for an order so every WhatsApp template shows the
 * exact same numbers: what was already collected online and what the delivery
 * agent must collect. Falls back to total - advance when balance_due is stale.
 */
export function resolvePaymentSplit(o: PaymentShape) {
  const sym = o.currency === "INR" || !o.currency ? "₹" : `${o.currency} `;
  const total = Math.max(Number(o.total ?? 0), 0);
  const advance = Math.max(Number(o.advance_paid ?? 0), 0);
  const method = String(o.payment_method || "").toLowerCase();
  const ptype = String(o.payment_type || "").toLowerCase();
  const status = String(o.status || "").toLowerCase();

  const isPartial = ptype === "partial" || status === "partially_paid" || (advance > 0 && advance < total);
  const isPureCod = !isPartial && (method === "cod" || ptype === "cod");
  // Prepaid = anything that isn't COD/partial (full online payment).
  const isPrepaid = !isPartial && !isPureCod;

  let due: number;
  if (isPrepaid) due = 0;
  else if (isPureCod) due = total;
  else {
    const stated = Number(o.balance_due ?? NaN);
    const derived = Math.max(total - advance, 0);
    // Trust balance_due only when it is coherent with total/advance.
    due = Number.isFinite(stated) && stated > 0 && Math.abs(stated - derived) <= 1 ? stated : derived;
  }

  return { sym, total, advance, due, isPartial, isPureCod, isPrepaid };
}

const money = (sym: string, n: number) => `${sym}${Number(n).toFixed(0)}`;

/** What the customer has already paid online. Single line, no newlines (Meta rejects them). */
export function formatPaidSummary(o: PaymentShape): string {
  const { sym, total, advance, isPrepaid, isPureCod } = resolvePaymentSplit(o);
  if (isPrepaid) return `${money(sym, total)} paid online — order fully prepaid`;
  if (isPureCod) return `Nothing paid yet — Cash on Delivery order`;
  return `${money(sym, advance)} advance paid online`;
}

/** What the delivery agent must collect. Explicit "pay at delivery" wording. */
export function formatCodDueLine(o: PaymentShape): string {
  const { sym, due, isPrepaid } = resolvePaymentSplit(o);
  if (isPrepaid || due <= 0) return `Nothing to pay at delivery ✅`;
  return `Pay ${money(sym, due)} at delivery`;
}

/** Legacy single-line variant kept for older approved templates (v2). */
export function formatPaymentStatusLine(o: PaymentShape): string {
  const { sym, total, advance, due, isPrepaid, isPureCod } = resolvePaymentSplit(o);
  if (isPrepaid) return `✅ Payment received — ${money(sym, total)} (nothing to pay at delivery)`;
  if (isPureCod) return `💵 Cash on Delivery — pay ${money(sym, total)} at delivery`;
  return `💵 ${money(sym, advance)} advance paid · Pay ${money(sym, due)} at delivery`;
}


/** Best-effort courier label from a tracking URL or explicit courier name. */
export function inferCourierName(trackingUrl?: string | null, fallback = "Courier"): string {
  if (!trackingUrl) return fallback;
  try {
    const host = new URL(trackingUrl).hostname.toLowerCase();
    if (host.includes("delhivery")) return "Delhivery";
    if (host.includes("bluedart")) return "Blue Dart";
    if (host.includes("dtdc")) return "DTDC";
    if (host.includes("xpressbees")) return "Xpressbees";
    if (host.includes("ecomexpress")) return "Ecom Express";
    if (host.includes("shadowfax")) return "Shadowfax";
    if (host.includes("indiapost") || host.includes("speedpost")) return "India Post";
    if (host.includes("shiprocket")) return "Shiprocket";
    if (host.includes("nimbuspost")) return "NimbusPost";
    return fallback;
  } catch {
    return fallback;
  }
}
