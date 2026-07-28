import { Star } from "lucide-react";
import { useStoreReviews } from "@/hooks/useStoreReviews";

/**
 * Small rating pill that floats over the product gallery.
 * Tapping it scrolls the shopper straight to the reviews section on the PDP.
 */
export default function PdpReviewsBadge({ storeId, className = "" }: { storeId?: string; className?: string }) {
  const { average, total } = useStoreReviews(storeId);

  if (!total) return null;

  const goToReviews = (e: React.MouseEvent) => {
    e.stopPropagation();
    const el = document.getElementById("reviews");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <button
      type="button"
      onClick={goToReviews}
      className={`flex items-center gap-1.5 rounded-full border border-white/25 bg-black/55 px-2.5 py-1.5 text-white shadow-lg backdrop-blur-sm transition-transform active:scale-95 ${className}`}
      aria-label={`See all ${total} customer reviews`}
    >
      <Star className="h-3.5 w-3.5 fill-emerald-400 text-emerald-400" />
      <span className="text-[12px] font-bold leading-none">{average.toFixed(1)}</span>
      <span className="text-[11px] leading-none text-white/80">· See reviews</span>
    </button>
  );
}
