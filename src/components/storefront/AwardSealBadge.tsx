import sealAsset from "@/assets/badges/best-seller-seal.webp.asset.json";

/**
 * Merchant-toggled "Best Seller" award seal (gold starburst + red ribbon).
 *
 * Single shared transparent WebP: 320x286 source, q80, ~21KB, immutable CDN
 * URL — so it is fetched once per visitor and reused (memory-cached) by every
 * card and PDP that shows it. 320px covers the largest render (PDP 80px @3x
 * DPR = 268px) with no upscaling, so there is no visible quality loss.
 * lazy + low fetch priority keep it off the cold-load critical path.
 */
export default function AwardSealBadge({
  size = "card",
  className = "",
}: {
  size?: "card" | "pdp";
  className?: string;
}) {
  return (
    <img
      src={sealAsset.url}
      alt="Best Seller"
      width={320}
      height={286}
      loading="lazy"
      decoding="async"
      fetchPriority="low"
      aria-hidden="true"
      className={`pointer-events-none select-none drop-shadow-[0_2px_6px_rgba(0,0,0,0.28)] ${
        size === "pdp" ? "h-16 w-auto sm:h-20" : "h-9 w-auto sm:h-11"
      } ${className}`}
    />
  );
}
