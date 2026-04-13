/**
 * ProductCardHoverBar — Slide-up action bar on desktop hover.
 * Shows Quick View and Wishlist buttons.
 */
import { Eye, Heart } from "lucide-react";

interface Props {
  wishlisted: boolean;
  onQuickView: (e: React.MouseEvent) => void;
  onToggleWishlist: (e: React.MouseEvent) => void;
}

export default function ProductCardHoverBar({ wishlisted, onQuickView, onToggleWishlist }: Props) {
  return (
    <div
      className="absolute bottom-0 left-0 right-0 z-10 flex items-center justify-center gap-2 py-2.5 px-3 translate-y-full opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 ease-out"
      style={{
        background: "linear-gradient(to top, color-mix(in srgb, var(--storefront-bg, #000) 85%, transparent), color-mix(in srgb, var(--storefront-bg, #000) 50%, transparent))",
        backdropFilter: "blur(8px)",
      }}
    >
      <button
        onClick={onQuickView}
        className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider rounded-full transition-all hover:scale-105 active:scale-95"
        style={{
          backgroundColor: "var(--storefront-primary, hsl(var(--primary)))",
          color: "var(--storefront-btn-text, hsl(var(--primary-foreground)))",
        }}
        aria-label="Quick View"
      >
        <Eye className="h-3.5 w-3.5" />
        Quick View
      </button>
      <button
        onClick={onToggleWishlist}
        className="hidden lg:flex h-8 w-8 items-center justify-center rounded-full transition-all hover:scale-110 active:scale-95"
        style={{
          backgroundColor: wishlisted
            ? "color-mix(in srgb, #ef4444 15%, var(--storefront-bg, #fff))"
            : "color-mix(in srgb, var(--storefront-bg, #fff) 90%, transparent)",
        }}
        aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
      >
        <Heart
          className={`h-4 w-4 ${wishlisted ? "fill-current" : ""}`}
          style={{
            color: wishlisted ? "#ef4444" : "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 60%, transparent)",
          }}
        />
      </button>
    </div>
  );
}
