/**
 * Compact "copy order details" text for couriers/suppliers.
 *
 * Format (one block, easy to paste into WhatsApp/Telegram):
 *   Name
 *   Phone
 *   Street address (each comma part on its own line)
 *   City
 *   State
 *   Pincode
 *   COD 1750-100=1650   (advance subtracted when partly paid)
 *   From <store owner>
 *   Product title × qty (one line per item)
 */
import { buildOrderBreakdown, type OrderLike } from "@/lib/orderPaymentBreakdown";

export interface CopyOrderInput extends OrderLike {
  id: string;
  order_number?: number | null;
  currency?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  street_address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  tracking_number?: string | null;
  order_items?: Array<{ product_name?: string | null; quantity?: number | null; total?: number | null; unit_price?: number | null }> | null;
}

export interface CopyStoreInfo {
  name?: string | null;
  owner_name?: string | null;
}

export function orderDisplayId(order: { order_number?: number | null; id: string }) {
  return order.order_number ? `#${1000 + order.order_number}` : `#${order.id.slice(0, 8).toUpperCase()}`;
}

export function buildOrderCopyText(order: CopyOrderInput, store?: CopyStoreInfo | string | null): string {
  const info: CopyStoreInfo = typeof store === "string" ? { name: store } : store || {};
  const items = order.order_items || [];
  const itemsSubtotal = items.reduce(
    (s, it) => s + Number(it?.total ?? Number(it?.unit_price || 0) * Number(it?.quantity || 1)),
    0,
  );
  const bd = buildOrderBreakdown(order, itemsSubtotal);
  const r = (v: number) => Math.round(v);

  const lines: string[] = [];
  lines.push(order.customer_name || "Guest");
  lines.push("");
  if (order.customer_phone) {
    lines.push(String(order.customer_phone));
    lines.push("");
  }

  // Street address — split on commas so long addresses read as separate lines.
  String(order.street_address || "")
    .split(/\s*,\s*/)
    .map((p) => p.trim())
    .filter(Boolean)
    .forEach((p) => lines.push(p));

  if (order.city) lines.push(String(order.city).trim());
  if (order.state) lines.push(String(order.state).trim());
  if (order.pincode) lines.push(String(order.pincode).trim());

  lines.push("");
  if (bd.dueOnDelivery > 0) {
    lines.push(
      bd.paid > 0
        ? `COD ${r(bd.total)}-${r(bd.paid)}=${r(bd.dueOnDelivery)}`
        : `COD ${r(bd.dueOnDelivery)}`,
    );
  } else {
    lines.push(`COD 0 — fully prepaid (${r(bd.total)} paid)`);
  }

  const from = info.owner_name || info.name;
  if (from) {
    lines.push("");
    lines.push(`From ${from}`);
  }

  if (items.length) {
    lines.push("");
    items.forEach((it) => {
      const qty = Number(it?.quantity || 1);
      lines.push(`${it?.product_name || "Item"}${qty > 1 ? ` × ${qty}` : ""}`);
    });
  }

  return lines.join("\n");
}
