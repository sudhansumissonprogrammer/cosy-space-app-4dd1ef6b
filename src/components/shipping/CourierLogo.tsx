import { useState } from "react";
import { Truck } from "lucide-react";
import { courierMeta } from "@/lib/shipping/courierRegistry";
import { courierLogoSrc, WIDE_LOGOS } from "@/lib/shipping/courierLogos";

/**
 * Courier brand mark. Uses a locally bundled logo (scraped from the courier's
 * own brand assets) so it always renders — no third-party favicon service that
 * can be blocked or rate-limited. Falls back to a neutral truck chip.
 */
export default function CourierLogo({
  slug,
  size = 36,
  className = "",
}: {
  slug?: string | null;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const meta = courierMeta(slug);
  const src = courierLogoSrc(slug);
  const wide = slug ? WIDE_LOGOS.has(slug) : false;

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border bg-white ${className}`}
      style={{ width: size, height: size }}
      title={meta.name}
    >
      {src && !failed ? (
        <img
          src={src}
          alt={`${meta.name} logo`}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className={wide ? "w-[86%] object-contain" : "h-[70%] w-[70%] object-contain"}
        />
      ) : (
        <Truck className="h-1/2 w-1/2 opacity-60 text-neutral-500" />
      )}
    </span>
  );
}

