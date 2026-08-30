import sealAsset from "@/assets/badges/best-seller-seal.webp.asset.json";

/**
 * Merchant-toggled "Best Seller" award seal (gold starburst + red ribbon).
 * Transparent WebP, 320px source, ~25KB, lazy-loaded so it never touches
 * cold-load cost on grids where no product is flagged.
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
      aria-hidden="true"
      className={`pointer-events-none select-none drop-shadow-[0_2px_6px_rgba(0,0,0,0.28)] ${
        size === "pdp" ? "h-16 w-auto sm:h-20" : "h-9 w-auto sm:h-11"
      } ${className}`}
    />
  );
}
