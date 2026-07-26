/**
 * PdpTrustSeals — golden guarantee seals shown on the product page.
 *
 * Which seals appear is controlled per-store by the merchant from
 * Dashboard → Theme Settings → "Trust Seals on Product Page"
 * (`store_theme_config.pdp_trust_seals`, a jsonb array of seal keys).
 * When unset, a sensible default set is shown.
 *
 * Mobile: horizontal snap carousel with 4 seals visible per screen, the rest
 * slide in. Desktop: single row. Images are lazy + async decoded, so extra
 * seals never block PDP paint.
 */
import { useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import { resolveTrustSeals } from "./trustSealCatalog";

interface Props {
  /** Raw value of theme_config.pdp_trust_seals (array of keys, or undefined). */
  seals?: unknown;
}

export default function PdpTrustSeals({ seals }: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [showHint, setShowHint] = useState(true);

  const items = resolveTrustSeals(seals);
  if (!items.length) return null;

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
        {items.map((s) => (
          <img
            key={s.key}
            src={s.url}
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

      {showHint && items.length > 4 && (
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
