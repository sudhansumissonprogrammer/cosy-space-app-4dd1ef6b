// 🛡️ Recent-buyer marketing guard.
//
// Rule (STRICT, 4 days, platform-wide):
//   • If a phone number has placed a REAL order in the last 4 days, NO
//     marketing message goes to that number at all — any product, any store.
//   • Utility/order messages (confirmation, shipping, delivery) are NOT
//     affected; they never pass through this guard.
//   • After the 4-day window, marketing (e.g. a pending-order recovery
//     coupon) may go out again.
//
// Orders that are cancelled / failed / rejected / still-pending payment are
// NOT purchases: those leads are exactly who recovery messaging is for.

export const RECENT_BUYER_WINDOW_DAYS = 4;

export function phoneVariantsOf(raw: string | null | undefined): string[] {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return [];
  const ten = digits.length > 10 ? digits.slice(-10) : digits;
  return Array.from(new Set([digits, ten, `91${ten}`, `+91${ten}`].filter(Boolean)));
}

export type RecentBuyer = {
  hasPurchase: boolean;
  productIds: Set<string>;
  /** Blocks ALL marketing for the given cart/order product ids. */
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
    blocks(_candidateProductIds: string[]) {
      if (!hasPurchase) return { blocked: false };
      // STRICT: any real purchase inside the window blocks every marketing
      // message to this number, regardless of product.
      return { blocked: true, reason: `recent_buyer_${windowDays}d` };
    },
  };
}
