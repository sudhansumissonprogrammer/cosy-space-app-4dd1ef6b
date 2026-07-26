import badgeAsset from "@/assets/badges/best-seller-badge.webp.asset.json";

/**
 * Golden "Best Seller Product" seal shown next to Best Selling section titles.
 * Replaces the previous 🔥 emoji. Transparent WebP, 320px source, ~21KB.
 */
export default function BestSellerBadge({ className = "" }: { className?: string }) {
  return (
    <img
      src={badgeAsset.url}
      alt="Best Seller"
      width={320}
      height={271}
      loading="lazy"
      decoding="async"
      className={`inline-block h-7 sm:h-8 lg:h-9 w-auto align-middle shrink-0 ${className}`}
    />
  );
}
