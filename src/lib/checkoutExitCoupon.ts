import { isKalingaStore } from "@/lib/kalingaStore";
export const KALINGA_EXIT_CODE = "SAVE50";
export interface ExitCouponRow {
  code: string;
  discount_type: string;
  discount_value: number;
  min_order_amount?: number | null;
  starts_at?: string | null;
  expires_at?: string | null;
  max_uses?: number | null;
  used_count?: number | null;
  is_active?: boolean;
}
/** Only replace a smaller discount with one validated exit coupon. */
export function checkoutExitCoupon(store: { id?: string | null; slug?: string | null }, candidate: ExitCouponRow | null | undefined,
  subtotal: number, appliedCode?: string | null, currentDiscount = 0, now = Date.now()): { code: string; value: number } | null {
  if (!candidate?.code || candidate.is_active === false || subtotal <= 0) return null;
  const code = candidate.code.toUpperCase();
  if (isKalingaStore(store) && (code !== KALINGA_EXIT_CODE || candidate.discount_type !== "flat" || Number(candidate.discount_value) !== 50)) return null;
  if (code === appliedCode?.toUpperCase() || Number(candidate.min_order_amount || 0) > subtotal) return null;
  if (candidate.starts_at && Date.parse(candidate.starts_at) > now) return null;
  if (candidate.expires_at && Date.parse(candidate.expires_at) <= now) return null;
  if (candidate.max_uses != null && Number(candidate.used_count || 0) >= candidate.max_uses) return null;
  const raw = candidate.discount_type === "percentage" ? subtotal * Number(candidate.discount_value) / 100 : Number(candidate.discount_value);
  const value = Math.min(Math.round(raw), subtotal);
  if (!Number.isFinite(value) || value <= Math.max(0, currentDiscount)) return null;
  return { code, value };
}