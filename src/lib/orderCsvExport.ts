import { buildSourcePdpUrl, type SourceProduct, type SourceStore } from "@/lib/sourcePdpUrl";
import { orderDisplayId } from "@/lib/orderCopyText";
import { buildOrderBreakdown, type OrderLike } from "@/lib/orderPaymentBreakdown";

export interface ExportOrder extends OrderLike {
  id: string;
  order_number?: number | null;
  created_at?: string | null;
  status?: string | null;
  currency?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  street_address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  tracking_number?: string | null;
  order_items?: Array<{
    id?: string;
    product_name?: string | null;
    quantity?: number | null;
    unit_price?: number | null;
    total?: number | null;
    products?: SourceProduct | SourceProduct[];
  }> | null;
}

export const ORDER_CSV_HEADERS = [
  "Order ID", "Order Reference", "Order Date (UTC)", "Status", "Customer Name", "Phone Number",
  "Street Address", "City", "State", "Pincode", "Product Name", "Quantity", "Unit Price",
  "Item Total", "Supplier PDP Link", "Currency", "Order Total", "Payment Method", "Payment Type",
  "Amount Paid", "Balance Due", "Tracking Number",
];

// Quoting alone does not stop spreadsheet formula execution in customer-supplied text.
export function csvCell(value: unknown): string {
  let text = value == null ? "" : String(value);
  if (typeof value === "string" && /^[\s]*[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

/** One row per line item keeps supplier links aligned with the purchased product. */
export function buildOrdersCsv(orders: ExportOrder[], sourceStore: SourceStore): string {
  const rows: unknown[][] = [ORDER_CSV_HEADERS];
  for (const order of orders) {
    const items = order.order_items ?? [];
    const subtotal = items.reduce((sum, item) => sum + Number(item.total ?? Number(item.unit_price ?? 0) * Number(item.quantity ?? 0)), 0);
    const payment = buildOrderBreakdown(order, subtotal);
    for (const item of items.length ? items : [null]) {
      const product = Array.isArray(item?.products) ? item.products[0] : item?.products;
      rows.push([
        order.id, orderDisplayId(order), order.created_at, order.status, order.customer_name, order.customer_phone,
        order.street_address, order.city, order.state, order.pincode, item?.product_name, item?.quantity,
        item?.unit_price, item?.total, buildSourcePdpUrl(sourceStore, product), order.currency,
        payment.total, order.payment_method, order.payment_type, payment.paid, payment.dueOnDelivery,
        order.tracking_number,
      ]);
    }
  }
  return "\uFEFF" + rows.map(row => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

type ReadPage = (offset: number, limit: number, ids?: string[]) => Promise<ExportOrder[]>;

/** Never reuse the visible dashboard page: read every page, or exactly the selected IDs. */
export async function collectExportOrders(readPage: ReadPage, selectedIds?: string[]): Promise<ExportOrder[]> {
  const orders = new Map<string, ExportOrder>();
  const ids = selectedIds ? [...new Set(selectedIds)] : undefined;
  if (ids?.length === 0) return [];
  const groups = ids ? Array.from({ length: Math.ceil(ids.length / 100) }, (_, i) => ids.slice(i * 100, (i + 1) * 100)) : [undefined];
  for (const group of groups) {
    for (let offset = 0; ; ) {
      const page = await readPage(offset, 300, group);
      for (const order of page) orders.set(order.id, order);
      if (!page.length) break;
      offset += page.length;
      // A short page may be a server row cap; continue until an empty page.
    }
  }
  if (ids && (orders.size !== ids.length || ids.some(id => !orders.has(id)))) {
    throw new Error("Some selected orders are no longer available. Refresh the list and select them again.");
  }
  return [...orders.values()];
}

export function togglePageSelection(selected: Set<string>, pageIds: string[]): Set<string> {
  const next = new Set(selected);
  const allSelected = pageIds.length > 0 && pageIds.every(id => next.has(id));
  for (const id of pageIds) {
    if (allSelected) next.delete(id);
    else next.add(id);
  }
  return next;
}

export async function deliverOrderCsv(blob: Blob, filename: string): Promise<void> {
  const file = new File([blob], filename, { type: blob.type });
  if (matchMedia("(pointer: coarse)").matches && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: filename }); return; }
    catch (error) { if ((error as DOMException).name === "AbortError") return; }
  }
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}