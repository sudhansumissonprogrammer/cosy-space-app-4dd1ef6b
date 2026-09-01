/**
 * Master "copy order details" text.
 *
 * One tap in the merchant order sheet copies everything a store owner needs to
 * hand a parcel to a courier or paste into a supplier chat:
 *   order id · customer name · phone · full address · items · amount to collect.
 *
 * The collectable amount is derived from the SAME breakdown the UI shows
 * (`buildOrderBreakdown`), so a ₹1000 order with a ₹100 advance always reads
 * "Amount to collect (COD): ₹900" — never the gross total.
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

export function buildOrderCopyText(order: CopyOrderInput, storeName?: string | null): string {
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
  lines.push(`Order ${orderDisplayId(order)}${storeName ? ` — ${storeName}` : ""}`);
  lines.push(`Name: ${order.customer_name || "Guest"}`);
  if (order.customer_phone) lines.push(`Phone: ${order.customer_phone}`);
  if (address) lines.push(`Address: ${address}`);
  if (order.pincode) lines.push(`Pincode: ${order.pincode}`);

  if (items.length) {
    lines.push("");
    lines.push("Items:");
    for (const it of items) {
      lines.push(`- ${it?.product_name || "Item"} x${Number(it?.quantity || 1)}`);
    }
  }

  lines.push("");
  lines.push(`Order total: ${money(bd.total)}`);
  if (bd.paid > 0) lines.push(`${bd.isPartial ? "Advance paid" : "Paid online"}: ${money(bd.paid)}`);
  lines.push(
    bd.dueOnDelivery > 0
      ? `Amount to collect (COD): ${money(bd.dueOnDelivery)}`
      : "Amount to collect (COD): ₹0 — fully prepaid",
  );

  if (order.tracking_number) lines.push(`AWB: ${order.tracking_number}`);
  if (order.notes) lines.push(`Notes: ${order.notes}`);

  return lines.join("\n");
}
