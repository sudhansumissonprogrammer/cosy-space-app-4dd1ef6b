// 🛡️ Recent-buyer marketing guard.
//
// Rule (product-aware, 7 days, platform-wide):
//   • If a phone number has placed a REAL order in the last 7 days, never
//     re-pitch a product they already bought in that window.
//   • When we can't identify the cart's products, block outright — a shopper
//     who just paid must not receive generic marketing for 7 days.
//   • A genuinely DIFFERENT product may still be pitched.
//
// Orders that are cancelled / failed / rejected / still-pending payment are
// NOT purchases: those leads are exactly who recovery messaging is for.

export const RECENT_BUYER_WINDOW_DAYS = 7;

export function phoneVariantsOf(raw: string | null | undefined): string[] {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return [];
  const ten = digits.length > 10 ? digits.slice(-10) : digits;
  return Array.from(new Set([digits, ten, `91${ten}`, `+91${ten}`].filter(Boolean)));
}

export type RecentBuyer = {
  hasPurchase: boolean;
  productIds: Set<string>;
  /** Blocks marketing for the given cart/order product ids. */
  blocks: (candidateProductIds: string[]) => { blocked: boolean; reason?: string };
};

export async function loadRecentBuyer(
  admin: any,
  rawPhone: string | null | undefined,
  windowDays = RECENT_BUYER_WINDOW_DAYS,
): Promise<RecentBuyer> {
  const variants = phoneVariantsOf(rawPhone);
  const productIds = new Set<string>();
  let hasPurchase = false;

  if (variants.length) {
    const sinceIso = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();
    const { data } = await admin
      .from("orders")
      .select("id, order_items(product_id)")
      .in("customer_phone", variants)
      .not("status", "in", '("cancelled","failed","rejected","pending")')
      .gte("created_at", sinceIso)
      .limit(50);
    for (const o of (data as any[]) ?? []) {
      hasPurchase = true;
      for (const oi of (o.order_items ?? [])) {
        if (oi?.product_id) productIds.add(String(oi.product_id));
      }
    }
  }

  return {
    hasPurchase,
    productIds,
    blocks(candidateProductIds: string[]) {
      if (!hasPurchase) return { blocked: false };
      const ids = (candidateProductIds || []).map((p) => String(p || "")).filter(Boolean);
      if (!ids.length) {
        return { blocked: true, reason: `recent_buyer_${windowDays}d_unknown_product` };
      }
      if (ids.some((id) => productIds.has(id))) {
        return { blocked: true, reason: `recent_buyer_${windowDays}d_same_product` };
      }
      return { blocked: false };
    },
  };
}
