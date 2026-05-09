import { Banknote, RotateCcw, Truck, MessageCircle, BadgeCheck } from "lucide-react";

interface PdpTrustRowProps {
  freeShippingAbove?: number | null;
  hasWhatsApp?: boolean;
  currencySymbol?: string;
}

/**
 * Tight trust row shown immediately under the price on PDP.
 * Mobile: horizontal scroll. Desktop: wraps in flex.
 * Real lucide icons (no emoji) so it stays brand-quality.
 */
export default function PdpTrustRow({ freeShippingAbove, hasWhatsApp, currencySymbol = "₹" }: PdpTrustRowProps) {
  const items: { icon: React.ReactNode; label: string }[] = [
    { icon: <Banknote className="h-3.5 w-3.5" strokeWidth={2.4} />, label: "COD Available" },
    { icon: <RotateCcw className="h-3.5 w-3.5" strokeWidth={2.4} />, label: "7-Day Return" },
    {
      icon: <Truck className="h-3.5 w-3.5" strokeWidth={2.4} />,
      label: freeShippingAbove ? `Free Shipping over ${currencySymbol}${freeShippingAbove}` : "Free Shipping",
    },
  ];
  if (hasWhatsApp) {
    items.push({ icon: <MessageCircle className="h-3.5 w-3.5" strokeWidth={2.4} />, label: "WhatsApp Support" });
  }
  items.push({ icon: <BadgeCheck className="h-3.5 w-3.5" strokeWidth={2.4} />, label: "Made in India" });

  return (
    <div className="mt-3 -mx-1">
      <div className="flex flex-wrap gap-1.5 px-1 overflow-x-auto no-scrollbar md:flex-wrap md:overflow-visible">
        {items.map((it, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1.5 shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 leading-none"
          >
            <span className="text-emerald-700">{it.icon}</span>
            {it.label}
          </span>
        ))}
        <style>{`.no-scrollbar::-webkit-scrollbar{display:none}.no-scrollbar{scrollbar-width:none}`}</style>
      </div>
    </div>
  );
}
