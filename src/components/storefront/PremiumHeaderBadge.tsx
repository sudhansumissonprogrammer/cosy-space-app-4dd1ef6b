import badgeAsset from "@/assets/verified-badge.png.asset.json";

/**
 * PremiumHeaderBadge — Blue "Verified" tick shown beside the store name
 * in the storefront mobile header. Only meaningful when the store has no
 * uploaded logo (text logo). Gated by `show_premium_header_badge` theme
 * setting. Default off.
 */
export default function PremiumHeaderBadge({ className = "" }: { className?: string }) {
  return (
    <img
      src={badgeAsset.url}
      alt="Verified store"
      width={28}
      height={28}
      loading="eager"
      decoding="async"
      className={`h-[26px] w-[26px] sm:h-[30px] sm:w-[30px] object-contain shrink-0 select-none pointer-events-none ${className}`}
      draggable={false}
      title="Verified store"
    />
  );
}
