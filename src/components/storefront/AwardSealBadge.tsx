import sealAsset from "@/assets/badges/best-seller-seal.png.asset.json";

/**
 * Gold "BEST SELLER" award seal shown on hand-picked products.
 * Merchants toggle it per product (star icon in the dashboard product list).
 * Rendered as a lightweight overlay on product cards and the PDP gallery.
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
      width={816}
      height={816}
      loading="lazy"
      decoding="async"
      aria-hidden="true"
      className={`pointer-events-none select-none drop-shadow-[0_2px_6px_rgba(0,0,0,0.28)] ${
        size === "pdp" ? "h-16 w-16 sm:h-20 sm:w-20" : "h-10 w-10 sm:h-12 sm:w-12"
      } ${className}`}
    />
  );
}
