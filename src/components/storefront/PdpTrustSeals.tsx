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
  { src: exchange.url, alt: "Easy Return & Exchange" },
  { src: premium.url, alt: "100% Premium Quality" },
  { src: money.url, alt: "Money Back Guarantee" },
  { src: shipping.url, alt: "Fast & Free Shipping" },
  { src: secure.url, alt: "100% Secure Payments" },
  { src: support.url, alt: "24/7 Customer Support" },
  { src: satisfaction.url, alt: "100% Satisfaction Guarantee" },
];

export default function PdpTrustSeals() {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [showHint, setShowHint] = useState(true);

  return (
    <section className="mt-6 w-full max-w-full min-w-0 relative" aria-label="Store guarantees">
      <div
        ref={scrollerRef}
        onScroll={(e) => {
          if (e.currentTarget.scrollLeft > 8) setShowHint(false);
        }}
        className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-1 md:overflow-visible md:justify-between md:gap-2 pdp-seals"
        style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}
      >
        {SEALS.map((s) => (
          <img
            key={s.alt}
            src={s.src}
            alt={s.alt}
            title={s.alt}
            width={160}
            height={160}
            loading="lazy"
            decoding="async"
            className="shrink-0 snap-start h-auto object-contain w-[calc((100%-2.25rem)/4)] md:w-[13%] md:max-w-[74px]"
          />
        ))}
        <style>{`.pdp-seals::-webkit-scrollbar{display:none}@keyframes pdpNudge{0%,100%{transform:translate(0,-50%)}50%{transform:translate(4px,-50%)}}`}</style>
      </div>

      {showHint && (
        <button
          type="button"
          aria-label="Scroll to see more guarantees"
          onClick={() => {
            scrollerRef.current?.scrollBy({ left: 200, behavior: "smooth" });
            setShowHint(false);
          }}
          className="md:hidden absolute right-0 top-1/2 flex h-7 w-7 items-center justify-center rounded-full border bg-background/90 shadow-sm backdrop-blur-sm"
          style={{ transform: "translateY(-50%)", animation: "pdpNudge 1.4s ease-in-out infinite" }}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </section>
  );
}
