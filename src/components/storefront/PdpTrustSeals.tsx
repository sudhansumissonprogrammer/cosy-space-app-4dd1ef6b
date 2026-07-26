/**
 * PdpTrustSeals — golden guarantee seals shown on the product page.
 *
 * Replaces the old 3-card (Free Shipping / 7 Days Return / Help Desk) grid.
 * Mobile: horizontal snap carousel with exactly 4 seals visible per screen,
 * the remaining 3 slide in. Desktop: all 7 in a single row.
 */
import premium from "@/assets/trust/premium-quality.webp.asset.json";
import money from "@/assets/trust/money-back-guarantee.webp.asset.json";
import shipping from "@/assets/trust/fast-free-shipping.webp.asset.json";
import secure from "@/assets/trust/secure-payments.webp.asset.json";
import support from "@/assets/trust/support-247.webp.asset.json";
import satisfaction from "@/assets/trust/satisfaction-guarantee.webp.asset.json";
import exchange from "@/assets/trust/easy-return-exchange.webp.asset.json";

const SEALS = [
  { src: "/_tmpseals/premium-quality.webp", alt: "100% Premium Quality" },
  { src: "/_tmpseals/money-back-guarantee.webp", alt: "Money Back Guarantee" },
  { src: "/_tmpseals/fast-free-shipping.webp", alt: "Fast & Free Shipping" },
  { src: "/_tmpseals/secure-payments.webp", alt: "100% Secure Payments" },
  { src: "/_tmpseals/support-247.webp", alt: "24/7 Customer Support" },
  { src: "/_tmpseals/satisfaction-guarantee.webp", alt: "100% Satisfaction Guarantee" },
  { src: "/_tmpseals/easy-return-exchange.webp", alt: "Easy Return & Exchange" },
];

export default function PdpTrustSeals() {
  return (
    <section className="mt-6 w-full max-w-full min-w-0" aria-label="Store guarantees">
      <div
        className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-1 md:overflow-visible md:justify-between md:gap-2 pdp-seals"
        style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}
      >
        {SEALS.map((s) => (
          <img
            key={s.alt}
            src={s.src}
            alt={s.alt}
            title={s.alt}
            width={256}
            height={256}
            loading="lazy"
            decoding="async"
            className="shrink-0 snap-start h-auto object-contain w-[calc((100%-2.25rem)/4)] md:w-[13%] md:max-w-[74px]"
          />
        ))}
        <style>{`.pdp-seals::-webkit-scrollbar{display:none}`}</style>
      </div>
    </section>
  );
}
