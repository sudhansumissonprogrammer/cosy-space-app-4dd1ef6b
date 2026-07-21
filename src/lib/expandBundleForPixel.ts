/**
 * Meta Pixel / CAPI helpers for Bundle Builder line-items.
 *
 * A cart bundle carries a synthetic `bundle:<uuid>` productId that does NOT
 * exist in the catalog. If we send that to Meta as `content_ids`, catalog
 * matching fails and every InitiateCheckout / AddPaymentInfo event degrades
 * EMQ. Purchase already fires with the expanded children (server rewrites
 * order_items), so bridging the pre-purchase events to the same shape keeps
 * Meta's funnel consistent.
 *
 * Given a list of checkout items, return the flattened list of real product
 * ids + per-child priced rows suitable for `content_ids` / `contents`.
 * Non-bundle items pass through unchanged.
 */

export interface PixelLineItem {
  productId: string;
  price: number;
  quantity: number;
  name?: string;
  variantId?: string | null;
  meta?: any;
}

export function expandItemsForPixel<T extends PixelLineItem>(items: T[]): Array<{
  id: string;
  name: string;
  price: number;
  quantity: number;
  variantId?: string | null;
}> {
  const out: Array<{ id: string; name: string; price: number; quantity: number; variantId?: string | null }> = [];
  for (const it of items) {
    const isBundle = it?.meta?.kind === "bundle" && Array.isArray(it.meta?.children);
    if (!isBundle) {
      out.push({ id: it.productId, name: it.name ?? "", price: Number(it.price) || 0, quantity: it.quantity, variantId: it.variantId ?? null });
      continue;
    }
    const children = it.meta.children as Array<{ productId: string; name?: string }>;
    const N = Math.max(1, children.length);
    const perChild = (Number(it.price) || 0) / N;
    for (const c of children) {
      out.push({
        id: c.productId,
        name: c.name || it.name || "",
        price: Number(perChild.toFixed(2)),
        quantity: it.quantity,
      });
    }
  }
  return out;
}

/** Convenience: returns `{ content_ids, contents, num_items }` shape. */
export function pixelPayloadFromItems<T extends PixelLineItem>(items: T[]): {
  content_ids: string[];
  contents: Array<{ id: string; quantity: number; item_price: number }>;
  num_items: number;
} {
  const flat = expandItemsForPixel(items);
  return {
    content_ids: flat.map((f) => f.id),
    contents: flat.map((f) => ({ id: f.id, quantity: f.quantity, item_price: f.price })),
    num_items: flat.reduce((s, f) => s + (f.quantity || 1), 0),
  };
}