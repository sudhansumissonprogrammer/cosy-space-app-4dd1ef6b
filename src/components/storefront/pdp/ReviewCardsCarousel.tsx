import { useMemo, useState, lazy, Suspense } from "react";
import ReviewCard, { ReviewStars } from "@/components/storefront/reviews/ReviewCard";
import type { StoreReview } from "@/components/storefront/reviews/reviewTypes";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import DeferUntilVisible from "@/components/storefront/DeferUntilVisible";

const ReviewMediaLightbox = lazy(() => import("@/components/storefront/reviews/ReviewMediaLightbox"));

export default function ReviewCardsCarousel({ reviews, total, average }: { reviews: StoreReview[]; total: number; average: number }) {
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
    <section className="mb-3 mt-5 min-w-0" aria-label="Customer review cards">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-foreground">Customer reviews</h2>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ReviewStars rating={average} className="h-3 w-3" activeClassName="fill-warning text-warning" />
          <span>{average.toFixed(1)} · {total} reviews</span>
        </div>
      </div>
      <Carousel opts={{ align: "start", containScroll: "trimSnaps" }} className="pb-11" aria-label="Customer reviews carousel">
        <CarouselContent className="-ml-3 items-stretch">
          {reviews.map((review, index) => (
            <CarouselItem key={review.id} className="basis-[78%] pl-3 sm:basis-1/2">
              <DeferUntilVisible rootMargin="80px" minHeight={300}>
                <ReviewCard review={review} compact minimalOverlay showFullText
                  onOpenMedia={review.media.length ? (mediaIndex) => setGalleryIndex(offsets[index] + mediaIndex) : undefined} />
              </DeferUntilVisible>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="bottom-0 left-auto right-11 top-auto translate-y-0 rounded-md" title="Previous reviews" />
        <CarouselNext className="bottom-0 right-0 top-auto translate-y-0 rounded-md" title="Next reviews" />
      </Carousel>
      {galleryIndex !== null && gallery.length > 0 && (
        <Suspense fallback={null}>
          <ReviewMediaLightbox media={gallery} startIndex={galleryIndex} onClose={() => setGalleryIndex(null)} />
        </Suspense>
      )}
    </section>
  );
}