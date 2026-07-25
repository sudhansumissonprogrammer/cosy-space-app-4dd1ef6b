import badgeAsset from "@/assets/premium-guaranteed-badge.png.asset.json";

/**
 * PremiumHeaderBadge — Golden "Premium Product · Guaranteed" medallion
 * shown in the storefront mobile header when the merchant toggles
 * `show_premium_header_badge` in Theme Settings. Default off.
 *
 * Rendered small and crisp on mobile so it reads as a trust signal
 * without stealing space from the logo / action icons.
 */
export default function PremiumHeaderBadge({ className = "" }: { className?: string }) {
  return (
    <img
      src={badgeAsset.url}
      alt="Premium Product · Guaranteed"
      width={64}
      height={46}
      loading="eager"
      decoding="async"
      className={`h-9 sm:h-10 w-auto object-contain shrink-0 select-none pointer-events-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.25)] ${className}`}
      style={{ imageRendering: "auto" }}
      draggable={false}
    />
  );
}
