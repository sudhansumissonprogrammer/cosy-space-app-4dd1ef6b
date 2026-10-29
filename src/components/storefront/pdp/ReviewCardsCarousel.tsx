import { reviewCountLabel } from "@/lib/utkalCheckoutHints";
import { useMemo, useState, lazy, Suspense } from "react";
import { ReviewStars } from "@/components/storefront/reviews/ReviewCard";
import GlassReviewCard from "@/components/storefront/reviews/GlassReviewCard";
import { useStoreReviews } from "@/hooks/useStoreReviews";
import type { StoreReview } from "@/components/storefront/reviews/reviewTypes";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import DeferUntilVisible from "@/components/storefront/DeferUntilVisible";

const ReviewMediaLightbox = lazy(() => import("@/components/storefront/reviews/ReviewMediaLightbox"));

export function StoreReviewCardsCarousel({ storeId }: { storeId: string }) {
  const { reviews, total, average } = useStoreReviews(storeId, 14);
  return <ReviewCardsCarousel reviews={reviews} total={total} average={average} storeId={storeId} />;
}

export default function ReviewCardsCarousel({ reviews, total, average, storeId }: { reviews: StoreReview[]; total: number; average: number; storeId?: string }) {
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null);
  const { gallery, offsets } = useMemo(() => {
    const gallery: { url: string; type: "image" | "video" }[] = [];
    const offsets = reviews.map((review) => {
      const offset = gallery.length;
      gallery.push(...review.media);
      return offset;
    });
    return { gallery, offsets };
  }, [reviews]);

  if (!reviews.length) return null;

  return (
    <section className="mb-3 mt-7 min-w-0" aria-label="Customer review cards">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-semibold text-foreground">Customer reviews</h2>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ReviewStars rating={average} className="h-3 w-3" activeClassName="fill-warning text-warning" />
          <span>{average.toFixed(1)} · {reviewCountLabel(storeId, total)} reviews</span>
        </div>
      </div>
      <Carousel opts={{ align: "start", containScroll: "trimSnaps" }} className="pb-12" aria-label="Customer reviews carousel">
        <CarouselContent className="-ml-3 items-stretch pb-3">
          {reviews.map((review, index) => (
            <CarouselItem key={review.id} className="basis-[76%] pl-3 sm:basis-1/2">
              <DeferUntilVisible rootMargin="80px" minHeight={300}>
                <GlassReviewCard review={review}
                  onOpenMedia={review.media.length ? (mediaIndex) => setGalleryIndex(offsets[index] + mediaIndex) : undefined} />
              </DeferUntilVisible>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="review-glass h-9 w-9 border-border text-foreground bottom-0 left-auto right-12 top-auto translate-y-0 rounded-lg" title="Previous reviews" />
        <CarouselNext className="review-glass h-9 w-9 border-border text-foreground bottom-0 right-0 top-auto translate-y-0 rounded-lg" title="Next reviews" />
      </Carousel>
      {galleryIndex !== null && gallery.length > 0 && (
        <Suspense fallback={null}>
          <ReviewMediaLightbox media={gallery} startIndex={galleryIndex} onClose={() => setGalleryIndex(null)} />
        </Suspense>
      )}
    </section>
  );
}