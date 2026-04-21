import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Truck, Tag, Star, Copy, Check } from "lucide-react";

/** Delivery ETA pill — uses pincode saved in localStorage from checkout autofill. */
export function DeliveryEtaPill() {
  const [pincode, setPincode] = useState<string | null>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("storefront-delivery-pincode") || localStorage.getItem("checkout-pincode");
      if (raw) setPincode(raw.replace(/[^0-9]/g, "").slice(0, 6) || null);
    } catch { /* ignore */ }
  }, []);

  const eta = pincode ? "2–4 days" : "3–5 days";
  return (
    <div className="mx-4 mb-3 inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-100">
      <Truck className="h-4 w-4 text-emerald-700" strokeWidth={2.4} />
      <div className="text-[12px] text-emerald-900 font-semibold">
        Delivery in <span className="font-extrabold">{eta}</span>
        {pincode && <span className="font-normal text-emerald-700/80"> · to {pincode}</span>}
      </div>
    </div>
  );
}

/** Best available coupon teaser. Cached, single query per store. */
export function CouponTeaser({ storeId, orderTotal = 0 }: { storeId: string; orderTotal?: number }) {
  const [copied, setCopied] = useState(false);

  const { data: coupon } = useQuery({
    queryKey: ["pdp-coupon-teaser", storeId],
    enabled: !!storeId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      const { data } = await (supabase as any)
        .from("coupons")
        .select("code, discount_type, discount_value, min_order_amount, expires_at, is_active, starts_at")
        .eq("store_id", storeId)
        .eq("is_active", true)
        .lte("starts_at", nowIso)
        .or(`expires_at.is.null,expires_at.gte.${nowIso}`)
        .order("discount_value", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  if (!coupon) return null;
  const isPct = coupon.discount_type === "percent" || coupon.discount_type === "percentage";
  const valueLabel = isPct ? `${coupon.discount_value}% OFF` : `₹${coupon.discount_value} OFF`;
  const minLabel = coupon.min_order_amount > 0 ? ` on orders ₹${coupon.min_order_amount}+` : "";

  const copy = () => {
    navigator.clipboard?.writeText(coupon.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="mx-4 mb-3 flex items-center gap-3 p-3 rounded-xl border border-dashed border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50">
      <div className="h-9 w-9 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
        <Tag className="h-4.5 w-4.5 text-amber-700" strokeWidth={2.4} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-extrabold text-gray-900 leading-tight">{valueLabel}</div>
        <div className="text-[11px] text-gray-600 leading-tight">Use code <span className="font-bold">{coupon.code}</span>{minLabel}</div>
      </div>
      <button
        onClick={copy}
        className="shrink-0 inline-flex items-center gap-1 px-2.5 h-8 rounded-md bg-amber-600 text-white text-[11px] font-bold active:scale-95 transition"
      >
        {copied ? <><Check className="h-3.5 w-3.5" /> Copied</> : <><Copy className="h-3.5 w-3.5" /> Copy</>}
      </button>
    </div>
  );
}

/** Top reviews horizontal strip (max 3). Reuses already-fetched reviews array. */
export function TopReviewsStrip({ reviews }: { reviews: any[] }) {
  const top = (reviews || []).slice(0, 3);
  if (!top.length) return null;
  return (
    <div className="border-t border-gray-100 pt-4 pb-2">
      <div className="px-4 mb-2 flex items-center gap-2">
        <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
        <h3 className="text-[14px] font-extrabold text-gray-900">What people say</h3>
      </div>
      <div className="flex gap-2.5 overflow-x-auto px-4 pb-2 no-scrollbar">
        {top.map((r) => (
          <div key={r.id} className="shrink-0 w-[78%] max-w-[280px] rounded-xl border border-gray-100 bg-gray-50 p-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold text-white bg-emerald-600">
                {r.rating} <Star className="h-2.5 w-2.5 fill-white text-white" />
              </div>
              <span className="text-[11.5px] font-bold text-gray-900 truncate">{r.customer_name}</span>
            </div>
            {r.review_text && <p className="text-[12px] text-gray-700 leading-snug line-clamp-3">{r.review_text}</p>}
          </div>
        ))}
        <style>{`.no-scrollbar::-webkit-scrollbar{display:none}.no-scrollbar{scrollbar-width:none}.line-clamp-3{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}`}</style>
      </div>
    </div>
  );
}

/** "Frequently bought together" — first 2 similar products. Reuses similar query. */
export function BundleCard({
  basePrice,
  similar,
  onAddBundle,
}: {
  basePrice: number;
  similar: any[];
  onAddBundle: (ids: string[]) => void;
}) {
  const items = (similar || []).slice(0, 2);
  if (items.length === 0) return null;
  const bundleTotal = basePrice + items.reduce((s, p) => {
    const sp = p.sale_price ? Number(p.sale_price) : null;
    const bp = Number(p.price || 0);
    return s + (sp && sp < bp ? sp : bp);
  }, 0);
  const saving = Math.round(bundleTotal * 0.05); // visual hint of bundle saving (5%)

  return (
    <div className="mx-4 my-4 p-3 rounded-xl border border-gray-200 bg-white">
      <div className="text-[13px] font-extrabold text-gray-900 mb-2">Frequently bought together</div>
      <div className="flex items-center gap-2 mb-3">
        {items.map((p, i) => (
          <div key={p.id} className="flex items-center gap-2">
            <span className="text-gray-400 text-lg font-bold">+</span>
            <div className="h-12 w-12 rounded-lg overflow-hidden bg-gray-50 border border-gray-100 shrink-0">
              {p.image_url && <img src={p.image_url} alt="" className="h-full w-full object-cover" loading="lazy" />}
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] text-gray-500">Bundle total</div>
          <div className="text-[15px] font-black text-gray-900">₹{bundleTotal.toFixed(0)}</div>
          {saving > 0 && <div className="text-[10px] font-bold text-emerald-700">Save ~₹{saving}</div>}
        </div>
        <button
          onClick={() => onAddBundle(items.map((p) => p.id))}
          className="px-3 h-9 rounded-lg text-white text-[12px] font-extrabold uppercase tracking-wide"
          style={{ background: "var(--storefront-primary, #036B52)" }}
        >
          Add bundle
        </button>
      </div>
    </div>
  );
}

/** Stock urgency strip — shown only when 1-10 left. */
export function StockUrgencyStrip({ stock }: { stock: number | null | undefined }) {
  const s = Number(stock ?? 0);
  if (s <= 0 || s > 10) return null;
  return (
    <div className="mx-4 mb-3 px-3 py-2 rounded-lg bg-orange-50 border border-orange-100 flex items-center gap-2">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500" />
      </span>
      <span className="text-[12px] font-extrabold text-orange-900">
        Hurry! Only {s} left in stock
      </span>
    </div>
  );
}

/** Sticky ADD bar mini-thumb + name (used on V19/V20 PDP). */
export function StickyAddInfo({ thumb, name }: { thumb?: string; name: string }) {
  return (
    <div className="flex items-center gap-2.5 min-w-0 flex-1">
      <div className="h-10 w-10 rounded-lg overflow-hidden bg-gray-50 border border-gray-100 shrink-0">
        {thumb && <img src={thumb} alt="" className="h-full w-full object-cover" loading="lazy" />}
      </div>
      <div className="min-w-0">
        <div className="text-[12px] font-bold text-gray-900 truncate leading-tight">{name}</div>
        <div className="text-[10px] text-gray-500 leading-tight mt-0.5">In your cart soon</div>
      </div>
    </div>
  );
}
