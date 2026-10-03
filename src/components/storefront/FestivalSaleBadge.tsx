import badgeAsset from "@/assets/badges/festival-sale-badge.webp.asset.json";

interface FestivalSaleBadgeProps {
  compact?: boolean;
  className?: string;
}

export default function FestivalSaleBadge({ compact = false, className = "" }: FestivalSaleBadgeProps) {
  return (
    <img
      src={badgeAsset.url}
      alt="Festival sale live now"
      width={480}
      height={209}
      loading="eager"
      decoding="async"
      fetchPriority="low"
      className={`pointer-events-none select-none shrink-0 object-contain ${
        compact ? "w-[88px] sm:w-[104px]" : "w-[112px] sm:w-[132px]"
      } ${className}`}
    />
  );
}