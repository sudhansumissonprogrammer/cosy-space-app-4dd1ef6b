/**
 * Frontend-only preview of the WhatsApp-exclusive coupon price.
 *
 * Shoppers who land from a WhatsApp marketing link (`sf_wa_source`, set by
 * StorefrontAutoLogin when the redirect carries `wa=1`) get the store's
 * WhatsApp-exclusive auto-apply coupon at checkout. This hook resolves the
 * effective post-coupon price so the PDP can SHOW it.
 *
 * It never mutates cart/product/order pricing — the real discount is still
 * applied server-side at checkout.
 */
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { kalingaCouponPrice, usePendingCoupon, KALINGA_PREVIEW_CODE } from "@/lib/kalingaCouponPreview";

export interface WaCouponPreview {
  /** true only for WA arrivals with a valid, applicable exclusive coupon */
  active: boolean;
  discount: number;
  finalPrice: number;
  code?: string;
}

export function useIsWaSource(): boolean {
  const [isWaSource, setIsWaSource] = useState(() => {
    try { return sessionStorage.getItem("sf_wa_source") === "1"; } catch { return false; }
  });
  useEffect(() => {
    if (isWaSource) return;
    const sync = () => {
      try {
        if (sessionStorage.getItem("sf_wa_source") === "1") setIsWaSource(true);
      } catch { /* noop */ }
    };
    window.addEventListener("sf-wa-source", sync);
    const t = window.setTimeout(sync, 400);
    return () => { window.removeEventListener("sf-wa-source", sync); window.clearTimeout(t); };
  }, [isWaSource]);
  return isWaSource;
}

export function useWaCouponPreview(storeId?: string, basePrice?: number): WaCouponPreview {
  const isWaSource = useIsWaSource();
  const pendingCoupon = usePendingCoupon();

  const { data: waCoupon } = useQuery({
    queryKey: ["store-wa-coupon", storeId],
    enabled: !!storeId && isWaSource,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await (supabase as any).rpc("get_store_wa_coupon", { _store_id: storeId });
      return Array.isArray(data) ? data[0] ?? null : data ?? null;
    },
  });

  const price = Number(basePrice || 0);
  // Kalinga recovery links carry SAVE100 — show the ₹100-off price everywhere.
  const kalingaPrice = kalingaCouponPrice(storeId, pendingCoupon, price);
  if (kalingaPrice != null) {
    return { active: true, discount: price - kalingaPrice, finalPrice: kalingaPrice, code: KALINGA_PREVIEW_CODE };
  }
  if (!isWaSource || !waCoupon || !price || price <= 0) {
    return { active: false, discount: 0, finalPrice: price };
  }

  // Coupon only shows when the shopper actually qualifies for it.
  const minOrder = Number(waCoupon.min_order_amount || 0);
  if (price < minOrder) return { active: false, discount: 0, finalPrice: price };

  const isPct = waCoupon.discount_type === "percentage" || waCoupon.discount_type === "percent";
  const raw = isPct ? price * (Number(waCoupon.discount_value) / 100) : Number(waCoupon.discount_value);
  const discount = Math.max(0, Math.min(Math.round(raw), price));
  if (discount < 1) return { active: false, discount: 0, finalPrice: price };

  return {
    active: true,
    discount,
    finalPrice: Math.max(0, price - discount),
    code: waCoupon.code,
  };
}
