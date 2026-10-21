import { Heart } from "lucide-react";

/**
 * One wishlist heart for every product card style.
 * Bare outline heart — no glass chip / backdrop (merchant request).
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
  const icon = Math.round(size * 0.62);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick(e);
      }}
      className={`heart-burst ${bursting ? "bursting" : ""} rounded-full flex items-center justify-center bg-transparent transition-transform duration-200 active:scale-[0.92] ${className}`}
      style={{
        height: size,
        width: size,
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
            color: "#ffffff",
            strokeWidth: 2.2,
            opacity: wishlisted ? 0 : 1,
            transform: wishlisted ? "scale(0.25)" : "scale(1)",
            filter: wishlisted ? "none" : "drop-shadow(0 1px 2px rgba(0,0,0,0.45))",
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
            filter: wishlisted ? "drop-shadow(0 1px 2px rgba(0,0,0,0.45))" : "none",
            transition: `opacity 200ms ${EASE}, transform 200ms ${EASE}, filter 200ms ${EASE}`,
          }}
        />
      </span>
    </button>
  );
}
