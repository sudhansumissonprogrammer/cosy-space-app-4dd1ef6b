// Shared helpers for building user-visible content inside WhatsApp templates.
// Kept tiny and dependency-free so both wa-order-event and wa-cart-recovery-cron can use it.

/**
 * Returns an Indian-English expected delivery label, e.g. "Mon, 4 Sep 26".
 * Adds `days` calendar days to `from`, then if it lands on a Sunday pushes to Monday.
 */
export function formatExpectedDelivery(from: Date = new Date(), days = 6): string {
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
export function formatPaymentStatusLine(o: {
  payment_method?: string | null;
  payment_type?: string | null;
  total?: number | null;
  advance_paid?: number | null;
  balance_due?: number | null;
  currency?: string | null;
}): string {
  const sym = o.currency === "INR" || !o.currency ? "₹" : `${o.currency} `;
  const total = Number(o.total ?? 0);
  const advance = Number(o.advance_paid ?? 0);
  const balance = Number(o.balance_due ?? Math.max(total - advance, 0));
  const method = String(o.payment_method || "").toLowerCase();
  const ptype = String(o.payment_type || "").toLowerCase();
  const isCod = method === "cod" || ptype === "cod" || ptype === "partial";

  if (isCod && advance > 0 && balance > 0) {
    return `💵 Paid ${sym}${advance.toFixed(0)} advance · Pay ${sym}${balance.toFixed(0)} to the delivery boy on COD`;
  }
  if (isCod) {
    return `💵 COD — pay ${sym}${total.toFixed(0)} to the delivery boy on delivery`;
  }
  return `✅ Payment received — ${sym}${total.toFixed(0)}`;
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
