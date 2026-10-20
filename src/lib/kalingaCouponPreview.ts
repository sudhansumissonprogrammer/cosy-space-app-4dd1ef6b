import { useEffect, useState } from "react";
import { KALINGA_STORE_ID } from "@/lib/kalingaStore";

export const KALINGA_PREVIEW_CODE = "SAVE100";
export const KALINGA_PREVIEW_DISCOUNT = 100;

/** Display-only: price a Kalinga recovery visitor will pay after SAVE100. Null when not applicable. */
export function kalingaCouponPrice(storeId: string | null | undefined, code: string | null | undefined, price: number): number | null {
  if (storeId !== KALINGA_STORE_ID || String(code || "").toUpperCase() !== KALINGA_PREVIEW_CODE) return null;
  if (!Number.isFinite(price) || price <= KALINGA_PREVIEW_DISCOUNT) return null;
  return Math.round(price - KALINGA_PREVIEW_DISCOUNT);
}

function readCode(): string | null {
  try {
    return new URLSearchParams(window.location.search).get("coupon")
      || sessionStorage.getItem("pending_coupon") || localStorage.getItem("pending_coupon");
  } catch { return null; }
}

/** The coupon code captured from a WhatsApp recovery link, if any. */
export function usePendingCoupon(): string | null {
  const [code, setCode] = useState<string | null>(() => readCode());
  useEffect(() => {
    if (code) return;
    const t = window.setTimeout(() => setCode(readCode()), 300);
    return () => window.clearTimeout(t);
  }, [code]);
  return code ? code.toUpperCase() : null;
}
