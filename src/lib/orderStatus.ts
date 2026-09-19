// Single source of truth for order status across dashboard + storefront.
// Any new status MUST be added here — never inline a status map again.

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "partially_paid"
  | "shipped"
  | "delivered"
  | "rto"
  | "cancelled";

export const ORDER_STATUSES: OrderStatus[] = [
  "pending",
  "confirmed",
  "partially_paid",
  "shipped",
  "delivered",
  "rto",
  "cancelled",
];

type Meta = {
  label: string;          // human label shown to merchant + customer
  rank: number;           // position in the 4-step timeline (pending→delivered)
  dot: string;            // tailwind bg-* for status dot
  text: string;           // tailwind text-* for badge text
  bg: string;             // tailwind bg-* for badge background
  badge: string;          // combined badge classes (used by dashboard tables)
};

// Colors are locked: confirmed=blue, partially_paid=purple, shipped=violet,
// delivered=emerald, cancelled=red, pending=amber. Do not diverge per surface.
export const ORDER_STATUS_META: Record<OrderStatus, Meta> = {
  pending: {
    label: "Pending", rank: 0,
    dot: "bg-amber-500", text: "text-amber-700", bg: "bg-amber-50",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  },
  confirmed: {
    label: "Confirmed", rank: 1,
    dot: "bg-blue-500", text: "text-blue-700", bg: "bg-blue-50",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  },
  partially_paid: {
    label: "Partially Paid", rank: 1, // same step as Confirmed in the timeline
    dot: "bg-purple-500", text: "text-purple-700", bg: "bg-purple-50",
    badge: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  },
  shipped: {
    label: "Shipped", rank: 2,
    dot: "bg-violet-500", text: "text-violet-700", bg: "bg-violet-50",
    badge: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  },
  delivered: {
    label: "Delivered", rank: 3,
    dot: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50",
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  },
  rto: {
    label: "RTO", rank: -1,
    dot: "bg-orange-500", text: "text-orange-700", bg: "bg-orange-50",
    badge: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  },
  cancelled: {
    label: "Cancelled", rank: -1,
    dot: "bg-red-500", text: "text-red-700", bg: "bg-red-50",
    badge: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  },
};

export function getOrderStatusMeta(status: string | null | undefined): Meta {
  return ORDER_STATUS_META[(status as OrderStatus)] ?? ORDER_STATUS_META.pending;
}

export function orderStatusLabel(status: string | null | undefined): string {
  return getOrderStatusMeta(status).label;
}

export function orderStatusBadgeClass(status: string | null | undefined): string {
  return getOrderStatusMeta(status).badge;
}

export function orderStatusRank(status: string | null | undefined): number {
  return getOrderStatusMeta(status).rank;
}

// Status options for dashboard dropdowns / filters / bulk-update.
// Order matches the natural lifecycle the merchant sees.
export const ORDER_STATUS_OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: "pending",        label: ORDER_STATUS_META.pending.label },
  { value: "confirmed",      label: ORDER_STATUS_META.confirmed.label },
  { value: "partially_paid", label: ORDER_STATUS_META.partially_paid.label },
  { value: "shipped",        label: ORDER_STATUS_META.shipped.label },
  { value: "delivered",      label: ORDER_STATUS_META.delivered.label },
  { value: "rto",            label: ORDER_STATUS_META.rto.label },
  { value: "cancelled",      label: ORDER_STATUS_META.cancelled.label },
];

/**
 * Customer-facing payment line on the storefront order detail.
 * Separates fulfillment status (orders.status) from payment state so a
 * pending partial order never falsely says "Partially Paid".
 */
export function paymentDisplay(order: {
  status?: string | null;
  payment_type?: string | null;
  payment_method?: string | null;
  payment_verified?: boolean | null;
}): { label: string; tone: "paid" | "pending" | "cod" } {
  const isCod = !!order.payment_method && /cod|cash/i.test(order.payment_method);
  const isPartial = order.payment_type === "partial";
  const verified = !!order.payment_verified;
  const status = order.status || "";

  if (status === "partially_paid") return { label: "Advance paid · Balance on delivery", tone: "paid" };
  if (status === "rto")           return { label: verified ? "Paid · Returned to seller" : "Returned to seller", tone: verified ? "paid" : "cod" };
  if (status === "cancelled")     return { label: isCod ? "Pay on Delivery" : verified ? "Paid" : "Not paid", tone: isCod ? "cod" : verified ? "paid" : "pending" };

  if (isPartial && !verified)     return { label: "Advance payment pending", tone: "pending" };
  if (isCod && !isPartial)        return { label: "Pay on Delivery", tone: "cod" };
  if (verified)                   return { label: "Paid", tone: "paid" };
  return { label: "Payment pending", tone: "pending" };
}

