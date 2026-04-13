import { memo } from "react";

interface StarRatingProps {
  rating: number;
  size?: string;
  showValue?: boolean;
  textColor?: string;
  /** Color for filled stars — defaults to storefront primary or gold */
  starColor?: string;
}

/** Shared star rating SVG component — eliminates duplication across 6+ files */
function StarRatingInner({ rating, size = "h-3 w-3", showValue = false, textColor, starColor }: StarRatingProps) {
  const fullStars = Math.floor(rating);
  const filledColor = starColor || "var(--storefront-star-color, #FFD700)";
  const emptyColor = "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 15%, transparent)";
  return (
    <div className="flex items-center gap-0.5">
      {[...Array(5)].map((_, i) => (
        <svg key={i} className={size} viewBox="0 0 20 20" fill={i < fullStars ? filledColor : emptyColor}>
          <path d="M10 15.27L16.18 19l-1.64-7.03L20 7.24l-7.19-.61L10 0 7.19 6.63 0 7.24l5.46 4.73L3.82 19z" />
        </svg>
      ))}
      {showValue && (
        <span className="text-[10px] opacity-50" style={{ color: textColor || "var(--storefront-text, hsl(var(--foreground)))" }}>
          {rating}
        </span>
      )}
    </div>
  );
}

const StarRating = memo(StarRatingInner);
export default StarRating;
