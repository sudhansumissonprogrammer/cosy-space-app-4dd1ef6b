import { ShieldCheck, Check, Camera } from "lucide-react";

interface PartialPaymentTrustCardProps {
  price: number;
  salePrice?: number | null;
  store: {
    partial_payment_enabled?: boolean | null;
    partial_payment_type?: string | null;
    partial_payment_value?: number | null;
  } | null | undefined;
  currencySymbol?: string;
  className?: string;
}

/**
 * Compact trust card shown on PDP for stores with partial payment enabled.
 * Communicates "small advance now, rest on delivery" + parcel-photo promise
 * to reduce checkout drop-off and build trust on COD orders.
 *
 * Returns null when the store hasn't enabled partial payment.
 * Calculation mirrors CheckoutPage.tsx (per-unit, qty=1, min ₹50 floor).
 */
export default function PartialPaymentTrustCard({
  price,
  salePrice,
  store,
  currencySymbol = "₹",
  className = "",
}: PartialPaymentTrustCardProps) {
  if (!store?.partial_payment_enabled) return null;
  const value = Number(store.partial_payment_value || 0);
  if (value <= 0) return null;

  const effective = salePrice && salePrice < price ? Number(salePrice) : Number(price);
  if (!effective || effective <= 0) return null;

  const type = store.partial_payment_type || "percentage";
  let advance =
    type === "percentage"
      ? Math.round(effective * (value / 100))
      : Math.min(value, effective);
  advance = Math.max(advance, 50); // mirrors checkout floor
  advance = Math.min(advance, effective); // never exceed price
  const balance = Math.max(0, effective - advance);

  const fmt = (n: number) => `${currencySymbol}${Math.round(n).toLocaleString("en-IN")}`;

  return (
    <div
      className={`mx-4 my-3 rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white overflow-hidden ${className}`}
    >
      {/* Headline split */}
      <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-emerald-600/95 text-white">
        <ShieldCheck className="h-4 w-4 shrink-0" strokeWidth={2.6} />
        <div className="text-[12.5px] font-extrabold leading-tight tracking-tight">
          Pay only <span className="text-white">{fmt(advance)}</span> now
          <span className="opacity-80 font-bold"> · </span>
          <span className="text-white">{fmt(balance)}</span> on delivery
        </div>
      </div>

      {/* Bullets */}
      <div className="px-3.5 py-2.5 space-y-1.5">
        <div className="flex items-start gap-2">
          <Check className="h-3.5 w-3.5 text-emerald-700 shrink-0 mt-0.5" strokeWidth={3} />
          <p className="text-[11.5px] leading-snug text-gray-700">
            Small advance to confirm your order — helps reduce fake orders
          </p>
        </div>
        <div className="flex items-start gap-2">
          <Check className="h-3.5 w-3.5 text-emerald-700 shrink-0 mt-0.5" strokeWidth={3} />
          <p className="text-[11.5px] leading-snug text-gray-700">
            Pay the remaining <span className="font-bold text-gray-900">{fmt(balance)}</span> in cash when your parcel is delivered
          </p>
        </div>
        <div className="flex items-start gap-2 pt-1 mt-1 border-t border-emerald-100">
          <Camera className="h-3.5 w-3.5 text-emerald-700 shrink-0 mt-0.5" strokeWidth={2.6} />
          <p className="text-[11.5px] leading-snug text-gray-600">
            We'll send your <span className="font-semibold text-gray-800">parcel photo on WhatsApp</span> before dispatch
          </p>
        </div>
      </div>
    </div>
  );
}
