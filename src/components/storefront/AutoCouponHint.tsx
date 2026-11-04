import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tag, X, Sparkles } from "lucide-react";
import { createPortal } from "react-dom";


interface Props {
  storeId?: string;
  /** Store slug — used to apply store-specific visibility gates. */
  storeSlug?: string;
  basePrice: number;
  currency?: string;
  /** Optional wrapper class for the pill */
  className?: string;
}

function fmt(n: number, currency = "INR") {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
      useGrouping: false,
    }).format(Math.max(0, Math.round(n)));
  } catch {
    return `₹${Math.max(0, Math.round(n))}`;
  }
}

/**
 * PDP hint that surfaces the auto-apply coupon a shopper will actually get at
 * checkout:
 *  - arrived from a WhatsApp marketing link (`sf_wa_source`) → the store's
 *    WhatsApp-exclusive coupon (bigger discount), matching what
 *    CheckoutV2Page auto-applies for that visitor.
 *  - everyone else → the store-wide auto-apply coupon.
 * Purely informational; the coupon itself is applied at checkout.
 */
export function AutoCouponHint({ storeId, storeSlug, basePrice, currency = "INR", className }: Props) {
  const [open, setOpen] = useState(false);

  // WA arrivals are flagged by StorefrontAutoLogin, which may run a tick after
  // this component mounts — listen for the event so the price updates in place.
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

  const { data: storeCoupon } = useQuery({
    queryKey: ["store-auto-apply-coupon", storeId],
    enabled: !!storeId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await (supabase as any).rpc("get_store_auto_apply_coupon", { _store_id: storeId });
      return Array.isArray(data) ? data[0] ?? null : data ?? null;
    },
  });

  const { data: waCoupon } = useQuery({
    queryKey: ["store-wa-coupon", storeId],
    enabled: !!storeId && isWaSource,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await (supabase as any).rpc("get_store_wa_coupon", { _store_id: storeId });
      return Array.isArray(data) ? data[0] ?? null : data ?? null;
    },
  });

  const coupon = (isWaSource && waCoupon) ? waCoupon : storeCoupon;

  if (!coupon || !basePrice || basePrice <= 0) return null;



  const minOrder = Number(coupon.min_order_amount || 0);
  const meetsMin = basePrice >= minOrder;
  const isPct = coupon.discount_type === "percentage" || coupon.discount_type === "percent";
  const rawDiscount = isPct
    ? basePrice * (Number(coupon.discount_value) / 100)
    : Number(coupon.discount_value);
  const discount = Math.max(0, Math.min(rawDiscount, basePrice));
  if (discount < 1) return null;
  const finalPrice = Math.max(0, basePrice - discount);

  const discountLabel = isPct
    ? `${Number(coupon.discount_value)}% OFF`
    : `${fmt(Number(coupon.discount_value), currency)} OFF`;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ??
          "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-dashed border-emerald-300 bg-gradient-to-br from-emerald-50 to-teal-50 text-left active:scale-[0.99] transition"
        }
      >
        <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
          <Tag className="h-4 w-4 text-emerald-700" strokeWidth={2.4} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-bold text-emerald-900 leading-tight">
            Get it for as low as <span className="text-[14px] font-extrabold">{fmt(finalPrice, currency)}</span>
          </div>
          <div className="text-[10.5px] text-emerald-800/80 leading-tight">
            {meetsMin ? "Coupon auto-applied at checkout · tap to see how" : "Tap to see how to unlock this price"}
          </div>
        </div>
        <div className="text-[10px] font-extrabold text-emerald-700 shrink-0">HOW?</div>
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[999] flex items-end sm:items-center justify-center bg-black/50 animate-in fade-in"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full sm:w-[420px] max-w-full bg-white sm:rounded-2xl rounded-t-2xl overflow-hidden shadow-2xl animate-in slide-in-from-bottom-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative px-5 pt-5 pb-4 bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="absolute top-3 right-3 h-8 w-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="h-4 w-4" />
                <span className="text-[11px] font-extrabold tracking-wider uppercase">Coupon inside</span>
              </div>
              <div className="text-[22px] font-black leading-tight">
                Save {fmt(discount, currency)}
              </div>
              <div className="text-[13px] font-semibold opacity-90">
                Effective price {fmt(finalPrice, currency)}
              </div>
            </div>

            <div className="p-5 space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                <div className="h-10 w-10 rounded-full bg-white flex items-center justify-center border border-emerald-200">
                  <Tag className="h-5 w-5 text-emerald-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-semibold text-emerald-800/80 uppercase tracking-wide">Coupon code</div>
                  <div className="text-[18px] font-black text-emerald-900 font-mono">{coupon.code}</div>
                </div>
                <div className="text-[11px] font-extrabold text-white bg-emerald-600 px-2 py-1 rounded">
                  {discountLabel}
                </div>
              </div>

              <div>
                <div className="text-[13px] font-bold text-gray-900 mb-2">How to claim</div>
                <ol className="space-y-2">
                  {[
                    "Add this product to your cart",
                    "Proceed to checkout",
                    `Coupon ${coupon.code} is auto-applied — no code to type`,
                    `Pay only ${fmt(finalPrice, currency)} for this item`,
                  ].map((step, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-[12.5px] text-gray-700">
                      <span className="h-5 w-5 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      <span className="leading-snug">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>

              {minOrder > 0 && (
                <div className="text-[11.5px] text-gray-500 px-1">
                  Minimum order {fmt(minOrder, currency)} required.
                </div>
              )}

              <button
                onClick={() => setOpen(false)}
                className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[13px] uppercase tracking-wider active:scale-[0.98] transition"
              >
                Got it
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

export default AutoCouponHint;
