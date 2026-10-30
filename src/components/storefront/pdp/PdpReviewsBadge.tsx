import { reviewCountLabel } from "@/lib/utkalCheckoutHints";
import { Star } from "lucide-react";
import { useStoreReviews } from "@/hooks/useStoreReviews";
import { Button } from "@/components/ui/button";

/**
 * Small rating pill that floats over the product gallery.
 * Tapping it requests the store-scoped sheet, even before its lazy chunk loads.
 */
export default function PdpReviewsBadge({ storeId, onOpenReviews, className = "" }: { storeId?: string; onOpenReviews: () => void; className?: string }) {
  const { total, reviews } = useStoreReviews(storeId, 14);

  if (!total && !reviews.length) return null;

  const goToReviews = (e: React.MouseEvent) => {
    e.stopPropagation();
    onOpenReviews();
  };


  return (
    <Button
      variant="ghost"
      type="button"
      onClick={goToReviews}
      className={`h-auto flex items-center gap-1 rounded-full border border-primary-foreground/25 bg-primary/55 px-1.5 py-0.5 text-primary-foreground shadow-md backdrop-blur-sm transition-transform hover:bg-primary/70 hover:text-primary-foreground active:scale-95 ${className}`}
      aria-label={`See all ${reviewCountLabel(storeId, total)} customer reviews`}
    >
      <span className="flex items-center gap-0.5">
        <Star className="h-2.5 w-2.5 fill-success text-success" />
        <Star className="h-2.5 w-2.5 fill-success text-success" />
      </span>
      <span className="text-[9px] font-semibold leading-none text-primary-foreground/90">See reviews</span>
    </Button>
  );
}

