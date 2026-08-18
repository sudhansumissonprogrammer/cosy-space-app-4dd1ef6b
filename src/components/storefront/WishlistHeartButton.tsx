import { Heart } from "lucide-react";

/**
 * One wishlist heart for every product card style.
 * Clean minimal glassmorphic chip + cross-fade heart (no fill toggling).
 */
interface Props {
  wishlisted: boolean;
  bursting?: boolean;
  onClick: (e: React.MouseEvent) => void;
  /** Positioning / visibility classes supplied by the card */
  className?: string;
  /** Chip diameter in px */
  size?: number;
}

const EASE = "cubic-bezier(0.2,0,0,1)";

export default function WishlistHeartButton({
  wishlisted,
  bursting = false,
  onClick,
  className = "",
  size = 30,
}: Props) {
  const icon = Math.round(size * 0.53);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick(e);
      }}
      className={`heart-burst ${bursting ? "bursting" : ""} flex items-center justify-center rounded-full transition-transform duration-200 active:scale-[0.92] ${className}`}
      style={{
        height: size,
        width: size,
        backgroundColor: wishlisted
          ? "color-mix(in srgb, #ef4444 14%, var(--storefront-bg, #fff))"
          : "color-mix(in srgb, var(--storefront-bg, #fff) 78%, transparent)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        border: "1px solid color-mix(in srgb, var(--storefront-text, #000) 8%, transparent)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.10)",
      }}
      aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
    >
      <span className="relative inline-block" style={{ height: icon, width: icon }}>
        <Heart
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            height: icon,
            width: icon,
            fill: "transparent",
            color: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 55%, transparent)",
            strokeWidth: 2,
            opacity: wishlisted ? 0 : 1,
            transform: wishlisted ? "scale(0.25)" : "scale(1)",
            filter: wishlisted ? "blur(4px)" : "blur(0)",
            transition: `opacity 200ms ${EASE}, transform 200ms ${EASE}, filter 200ms ${EASE}`,
          }}
        />
        <Heart
          aria-hidden="true"
          className="absolute inset-0 fill-current"
          style={{
            height: icon,
            width: icon,
            color: "#ef4444",
            opacity: wishlisted ? 1 : 0,
            transform: wishlisted ? "scale(1)" : "scale(0.25)",
            filter: wishlisted ? "blur(0)" : "blur(4px)",
            transition: `opacity 200ms ${EASE}, transform 200ms ${EASE}, filter 200ms ${EASE}`,
          }}
        />
      </span>
    </button>
  );
}
