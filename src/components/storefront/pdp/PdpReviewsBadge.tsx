import { Star } from "lucide-react";
import { useStoreReviews } from "@/hooks/useStoreReviews";

/**
 * Small rating pill that floats over the product gallery.
 * Tapping it scrolls the shopper straight to the reviews section on the PDP.
 */
export default function PdpReviewsBadge({ storeId, className = "" }: { storeId?: string; className?: string }) {
  const { total } = useStoreReviews(storeId, 14);

  if (!total) return null;

  const goToReviews = (e: React.MouseEvent) => {
    e.stopPropagation();
    // The reviews block is lazy-mounted, so on first tap only the placeholder
    // exists. Scroll to the placeholder, then re-align once the real section
    // renders.
    const scrollTo = (smooth: boolean) => {
      const el = document.getElementById("reviews") || document.getElementById("reviews-anchor");
      if (el) el.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
      return !!document.getElementById("reviews");
    };
    scrollTo(true);
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      const mounted = scrollTo(false);
      if (mounted || tries > 12) clearInterval(timer);
    }, 150);
  };


  return (
    <button
      type="button"
      onClick={goToReviews}
      className={`flex items-center gap-1 rounded-full border border-white/25 bg-black/55 px-1.5 py-0.5 text-white shadow-md backdrop-blur-sm transition-transform active:scale-95 ${className}`}
      aria-label={`See all ${total} customer reviews`}
    >
      <span className="flex items-center gap-0.5">
        <Star className="h-2.5 w-2.5 fill-emerald-400 text-emerald-400" />
        <Star className="h-2.5 w-2.5 fill-emerald-400 text-emerald-400" />
      </span>
      <span className="text-[9px] font-semibold leading-none text-white/90">See reviews</span>
    </button>
  );
}

