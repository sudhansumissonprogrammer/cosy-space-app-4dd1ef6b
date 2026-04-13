import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface StorefrontTrustStripProps {
  storeId: string;
  currency?: string;
}

/**
 * Trust / guarantee strip — black background, white text & icons.
 * Shown after product sections on every theme homepage.
 *
 * Mobile: vertical stack (list). Desktop: horizontal 4-column grid.
 * Shipping config is pre-seeded by get_storefront_shell → StorefrontLayout.logic.
 * Falls back to a lightweight fetch only if cache is cold.
 */
export default function StorefrontTrustStrip({ storeId, currency = "INR" }: StorefrontTrustStripProps) {
  const { data: shippingConfig } = useQuery({
    queryKey: ["storefront-shipping-config", storeId],
    queryFn: async () => {
      // Fallback: only fires if shell didn't seed the cache
      const { data } = await supabase
        .from("store_shipping_config")
        .select("free_shipping_above, flat_rate, is_active")
        .eq("store_id", storeId)
        .maybeSingle();
      return data;
    },
    staleTime: 10 * 60 * 1000,
  });

  const currencySymbol = currency === "USD" ? "$" : "₹";
  const threshold = shippingConfig?.free_shipping_above;
  const shippingText = threshold
    ? `Free Shipping for orders over ${currencySymbol}${threshold}`
    : "Free Shipping on all orders above ₹499";

  return (
    <section className="w-full" style={{ backgroundColor: "#111111", color: "#ffffff" }}>
      <div className="mx-auto max-w-6xl lg:max-w-7xl px-4 py-8 md:py-10">
        {/* Mobile: vertical list */}
        <div className="flex flex-col gap-6 md:hidden">
          <TrustItem icon={<TruckIcon />} title="Free Shipping" description={shippingText} />
          <TrustItem icon={<ReturnIcon />} title="Easy returns/Refund" description="Hustle Free Return Policy" />
          <TrustItem icon={<SupportIcon />} title="Online Support" description="24 hours a day, 7 days a week" />
          <TrustItem icon={<PaymentIcon />} title="Flexible Payment" description="Pay with Multiple Payment Methods" />
        </div>

        {/* Desktop: horizontal 4-column grid */}
        <div className="hidden md:grid md:grid-cols-4 md:gap-6">
          <TrustItem icon={<TruckIcon />} title="Free Shipping" description={shippingText} />
          <TrustItem icon={<ReturnIcon />} title="Easy returns/Refund" description="Hustle Free Return Policy" />
          <TrustItem icon={<SupportIcon />} title="Online Support" description="24 hours a day, 7 days a week" />
          <TrustItem icon={<PaymentIcon />} title="Flexible Payment" description="Pay with Multiple Payment Methods" />
        </div>
      </div>
    </section>
  );
}

function TrustItem({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex items-center gap-4 lg:gap-5">
      <div className="flex h-14 w-14 lg:h-16 lg:w-16 shrink-0 items-center justify-center">
        {icon}
      </div>
      <div className="flex flex-col">
        <span className="text-[15px] font-bold leading-tight" style={{ fontFamily: "var(--storefront-heading-font, 'Alegreya SC'), serif" }}>
          {title}
        </span>
        <span className="text-[13px] leading-snug opacity-70 mt-0.5" style={{ fontFamily: "var(--storefront-body-font, 'Inter'), sans-serif" }}>
          {description}
        </span>
      </div>
    </div>
  );
}

/* ── Exact SVG icons matching the reference ── */

function TruckIcon() {
  return (
     <svg className="w-12 h-12 lg:w-16 lg:h-16" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="18" width="34" height="22" rx="2" stroke="white" strokeWidth="2.5" fill="none" />
      <path d="M38 28H50L56 36V40H38V28Z" stroke="white" strokeWidth="2.5" fill="none" strokeLinejoin="round" />
      <circle cx="18" cy="44" r="5" stroke="white" strokeWidth="2.5" fill="none" />
      <circle cx="48" cy="44" r="5" stroke="white" strokeWidth="2.5" fill="none" />
      <rect x="2" y="8" width="22" height="12" rx="2" fill="white" />
      <text x="13" y="17" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#111111" fontFamily="Inter, sans-serif">FREE</text>
      <line x1="14" y1="20" x2="14" y2="24" stroke="white" strokeWidth="1.5" />
    </svg>
  );
}

function ReturnIcon() {
  return (
     <svg className="w-12 h-12 lg:w-16 lg:h-16" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="14" y="20" width="36" height="28" rx="2" stroke="white" strokeWidth="2.5" fill="none" />
      <line x1="14" y1="30" x2="50" y2="30" stroke="white" strokeWidth="2.5" />
      <line x1="32" y1="20" x2="32" y2="30" stroke="white" strokeWidth="2.5" />
      <path d="M10 38C10 30 16 24 24 24" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <polyline points="8,34 10,38 14,34" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 42C6 42 8 48 16 50" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
      <path d="M4 38C4 38 5 44 12 47" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
    </svg>
  );
}

function SupportIcon() {
  return (
     <svg className="w-12 h-12 lg:w-16 lg:h-16" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 16C12 13.79 13.79 12 16 12H48C50.21 12 52 13.79 52 16V36C52 38.21 50.21 40 48 40H24L16 48V40H16C13.79 40 12 38.21 12 36V16Z" stroke="white" strokeWidth="2.5" fill="none" strokeLinejoin="round" />
      <circle cx="24" cy="26" r="2.5" fill="white" />
      <circle cx="32" cy="26" r="2.5" fill="white" />
      <circle cx="40" cy="26" r="2.5" fill="white" />
    </svg>
  );
}

function PaymentIcon() {
  return (
    <svg className="w-12 h-12 lg:w-16 lg:h-16" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="8" y="16" width="40" height="28" rx="3" stroke="white" strokeWidth="2.5" fill="none" />
      <line x1="8" y1="26" x2="48" y2="26" stroke="white" strokeWidth="2.5" />
      <rect x="14" y="32" width="12" height="4" rx="1" fill="white" opacity="0.5" />
      <rect x="38" y="36" width="20" height="16" rx="2" fill="white" />
      <text x="48" y="47" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#111111" fontFamily="Inter, sans-serif">PAY</text>
      <rect x="52" y="10" width="8" height="14" rx="1.5" stroke="white" strokeWidth="1.5" fill="none" />
      <line x1="54" y1="21" x2="58" y2="21" stroke="white" strokeWidth="1" />
    </svg>
  );
}
