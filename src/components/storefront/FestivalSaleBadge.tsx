import badgeAsset from "@/assets/badges/festival-sale-badge.webp.asset.json";

interface FestivalSaleBadgeProps {
  compact?: boolean;
  className?: string;
  placement?: "price" | "card" | "pdp";
}

export default function FestivalSaleBadge({ compact = false, className = "", placement = "price" }: FestivalSaleBadgeProps) {
  const sizeClass = placement === "card"
    ? "w-[76px] sm:w-[88px]"
    : placement === "pdp"
      ? "w-[104px] sm:w-[122px]"
      : compact
        ? "w-[88px] sm:w-[104px]"
        : "w-[112px] sm:w-[132px]";
  const positionClass = placement === "price" ? "relative" : "";

  return (
    <span className={`festival-sale-badge pointer-events-none isolate block shrink-0 overflow-hidden ${positionClass} ${sizeClass} ${className}`}>
      <img
        src={badgeAsset.url}
        alt="Festival sale live now"
        width={480}
        height={209}
        loading={placement === "card" ? "lazy" : "eager"}
        decoding="async"
        fetchPriority="low"
        className="block h-auto w-full select-none object-contain"
      />
    </span>
  );
}