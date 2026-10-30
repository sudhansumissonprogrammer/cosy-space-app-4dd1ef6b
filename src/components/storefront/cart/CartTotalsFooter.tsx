import { Link } from "react-router-dom";
import { ReceiptIndianRupee } from "lucide-react";
import { formatPrice } from "@/lib/productUtils";
import { storefrontPath } from "@/lib/subdomain";
import shopbanaoLogo from "@/assets/shopbanao-logo.webp";
import { hidesPlatformBranding } from "@/lib/storefrontBranding";

interface Props {
  storeId?: string;
  slug: string;
  currency: string;
  /** Sum of MRP across cart lines (falls back to subtotal when unknown). */
  mrpTotal: number;
  /** Sum of effective line prices. */
  subtotal: number;
  /** Auto-apply coupon discount that will be applied at checkout. */
  couponDiscount: number;
  onCheckout: () => void;
}

const UPI_ICONS = [
  { src: "/icons/phonepe-round.webp", alt: "PhonePe" },
  { src: "/icons/paytm-round.webp", alt: "Paytm" },
  { src: "/icons/gpay-round.webp", alt: "Google Pay" },
];

/**
 * GoKwik-style totals footer: floating "saved so far" pill, estimated total
 * with struck MRP + % off, and a two-line checkout CTA with UPI icons.
 */
export default function CartTotalsFooter({
  storeId,
  slug,
  currency,
  mrpTotal,
  subtotal,
  couponDiscount,
  onCheckout,
}: Props) {
  const finalTotal = Math.max(0, subtotal - couponDiscount);
  const saved = Math.max(0, mrpTotal - finalTotal);
  const pctOff = mrpTotal > 0 && saved > 0 ? Math.round((saved / mrpTotal) * 100) : 0;

  return (
    <div className="relative">
      {saved > 0 && (
        <div className="pointer-events-none absolute -top-3 left-0 right-0 flex justify-center">
          <span className="rounded-md bg-emerald-600 px-3 py-1 text-[11px] font-extrabold text-white shadow">
            {formatPrice(saved, currency)} Saved so far!
          </span>
        </div>
      )}
      <div
        className="sfg sfg-sheet sfg-strong px-3 pb-2 pt-4"
        style={{ backgroundColor: "color-mix(in srgb, var(--storefront-bg, #fff) 66%, transparent)" }}
      >
        <div className="flex items-center justify-between">
          <span
            className="flex items-center gap-1.5 text-[14px] font-bold"
            style={{ color: "var(--storefront-text, inherit)" }}
          >
            <ReceiptIndianRupee className="h-4 w-4 opacity-70" />
            Estimated Total
          </span>
          <span className="text-right leading-tight">
            {mrpTotal > finalTotal && (
              <span className="mr-1.5 text-[12px] font-semibold line-through opacity-45">
                {formatPrice(mrpTotal, currency)}
              </span>
            )}
            <span className="text-[18px] font-black" style={{ color: "var(--storefront-text, inherit)" }}>
              {formatPrice(finalTotal, currency)}
            </span>
            {pctOff > 0 && (
              <span className="block text-[11px] font-bold text-emerald-600">({pctOff}% OFF)</span>
            )}
          </span>
        </div>

        <Link
          to={storefrontPath(slug, "checkout")}
          onClick={onCheckout}
          className="mt-2 flex w-full flex-col items-center justify-center rounded-xl py-2 transition active:scale-[0.98]"
          style={{
            backgroundColor: "var(--storefront-primary, hsl(var(--primary)))",
            color: "var(--storefront-btn-text, hsl(var(--primary-foreground)))",
            borderRadius: "var(--storefront-button-radius, 0.75rem)",
          }}
        >
          <span className="text-[15px] font-extrabold leading-tight">Checkout</span>
          {couponDiscount > 0 && (
            <span className="mt-0.5 flex items-center gap-1.5 text-[11px] font-semibold opacity-95">
              Get Extra {formatPrice(couponDiscount, currency)} Discount on UPI
              <span className="flex items-center -space-x-1">
                {UPI_ICONS.map((i) => (
                  <img
                    key={i.alt}
                    src={i.src}
                    alt={i.alt}
                    width={16}
                    height={16}
                    loading="lazy"
                    className="h-4 w-4 rounded-full ring-1 ring-white/70"
                  />
                ))}
              </span>
            </span>
          )}
        </Link>

        {!hidesPlatformBranding({ id: storeId, slug }) && <div className="mt-1.5 flex items-center justify-center gap-1 opacity-60">
          <span className="text-[9px] font-medium" style={{ color: "var(--storefront-text, inherit)" }}>
            Powered by
          </span>
          <img src={shopbanaoLogo} alt="" width={13} height={13} className="h-[13px] w-[13px]" loading="lazy" />
          <span className="text-[9px] font-bold" style={{ color: "var(--storefront-text, inherit)" }}>
            ShopBanao
          </span>
        </div>}

      </div>
    </div>
  );
}
