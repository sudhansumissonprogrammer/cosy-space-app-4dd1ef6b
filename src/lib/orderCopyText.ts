/**
 * Compact "copy order details" text for couriers/suppliers.
 *
 * Copies only the customer info and the exact cash to collect on delivery.
 * No order ID, store name, item list, or transaction breakdown — just the
 * COD value, derived from the SAME breakdown the UI shows (`buildOrderBreakdown`).
 * A ₹1000 order with a ₹100 advance always reads "Amount to collect (COD): ₹900".
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

export function orderDisplayId(order: { order_number?: number | null; id: string }) {
  return order.order_number ? `#${1000 + order.order_number}` : `#${order.id.slice(0, 8).toUpperCase()}`;
}

export function buildOrderCopyText(order: CopyOrderInput, _storeName?: string | null): string {
  const items = order.order_items || [];
  const itemsSubtotal = items.reduce(
    (s, it) => s + Number(it?.total ?? Number(it?.unit_price || 0) * Number(it?.quantity || 1)),
    0,
  );
  const bd = buildOrderBreakdown(order, itemsSubtotal);
  const cur = order.currency || "₹";
  const money = (v: number) => `${cur}${Math.round(v)}`;

  const address = [order.street_address, order.city, order.state, order.pincode]
    .map((v) => (v == null ? "" : String(v).trim()))
    .filter(Boolean)
    .join(", ");

  const lines: string[] = [];
  lines.push(`Name: ${order.customer_name || "Guest"}`);
  if (order.customer_phone) lines.push(`Phone: ${order.customer_phone}`);
  if (address) lines.push(`Address: ${address}`);
  if (order.pincode) lines.push(`Pincode: ${order.pincode}`);

  lines.push("");
  lines.push(
    bd.dueOnDelivery > 0
      ? `Amount to collect (COD): ${money(bd.dueOnDelivery)}`
      : "Amount to collect (COD): ₹0 — fully prepaid",
  );

  return lines.join("\n");
}
