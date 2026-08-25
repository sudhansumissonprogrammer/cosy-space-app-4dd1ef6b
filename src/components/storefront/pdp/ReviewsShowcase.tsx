import { useMemo, useState, useEffect, lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import { storefrontPath } from "@/lib/subdomain";
import { PenLine, ChevronRight, ArrowRight } from "lucide-react";
import ReviewCard, { ReviewStars } from "@/components/storefront/reviews/ReviewCard";
import { useStoreReviews } from "@/hooks/useStoreReviews";

const importWriteReviewDialog = () => import("@/components/storefront/reviews/WriteReviewDialog");
const WriteReviewDialog = lazy(importWriteReviewDialog);
const ReviewMediaLightbox = lazy(() => import("@/components/storefront/reviews/ReviewMediaLightbox"));


interface Props {
  productId: string;
  storeId: string;
  storeSlug: string;
  productName?: string;
}

export default function ReviewsShowcase({ productId, storeId, storeSlug, productName }: Props) {
  const [writing, setWriting] = useState(false);

  // NOTE: the dialog chunk is intentionally NOT warmed on idle. It drags in
  // uploadReviewMedia + textarea + radio-group + alert-dialog (~1.6s of
  // network time in the GTmetrix waterfall) for a control that <1% of
  // shoppers ever tap. It is warmed on pointerenter/touchstart instead —
  // see the "Write a review" button below.


  // Store-wide reviews — shared cache with the gallery rating badge, so this
  // section renders instantly when the badge has already fetched them.
  const { reviews, counts, total, average, refetch } = useStoreReviews(storeId);

  // Max 8 review cards on the PDP; a 9th "View all" card links to the full page.
  const shown = reviews.slice(0, 8);


  // Shared gallery so arrows move across every photo of the shown reviews.
  const { gallery, offsets } = useMemo(() => {
    const g: { url: string; type: "image" | "video" }[] = [];
    const o: number[] = [];
    shown.forEach((r) => {
      o.push(g.length);
      g.push(...r.media);
    });
    return { gallery: g, offsets: o };
  }, [shown]);

  const [galleryIndex, setGalleryIndex] = useState<number | null>(null);

  return (
    <section className="mt-10 border-t border-border pt-8" id="reviews">
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground sm:text-2xl">Customer reviews</h2>
          <p className="text-xs text-muted-foreground">Real photos & videos from verified shoppers</p>
        </div>
        <Link
          to={storefrontPath(storeSlug, "reviews")}
          className="flex shrink-0 items-center gap-0.5 text-xs font-semibold text-foreground underline-offset-4 hover:underline"
        >
          View all <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {reviews.length > 0 ? (
        <div className="mb-5 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {shown.map((r, ri) => (
            <div key={r.id} className="w-[78%] shrink-0 snap-start sm:w-[46%] lg:w-[32%]">
              <ReviewCard
                review={r}
                compact
                onOpenMedia={r.media.length ? (i) => setGalleryIndex(offsets[ri] + i) : undefined}
              />
            </div>
          ))}

          {reviews.length > 8 && (
            <div className="w-[78%] shrink-0 snap-start sm:w-[46%] lg:w-[32%]">
              <Link
                to={storefrontPath(storeSlug, "reviews")}
                className="flex h-full min-h-[220px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-accent/40 p-6 text-center transition-colors hover:bg-accent"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-foreground text-background">
                  <ArrowRight className="h-5 w-5" />
                </span>
                <span className="text-sm font-bold text-foreground">View all {total} reviews</span>
                <span className="text-xs text-muted-foreground">Photos & videos from customers</span>
              </Link>
            </div>
          )}
        </div>
      ) : (
        <p className="mb-5 rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Be the first to review this product.
        </p>
      )}


      <div className="rounded-2xl border border-border p-5">
        <div className="grid gap-5 sm:grid-cols-[auto_1fr] sm:items-center">
          <div className="text-center sm:text-left">
            <div className="text-4xl font-black leading-none text-foreground">{total ? average.toFixed(1) : "—"}</div>
            <div className="mt-1.5 flex justify-center sm:justify-start">
              <ReviewStars rating={average} className="h-4 w-4" />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {total > 0 ? `Based on ${total} review${total > 1 ? "s" : ""}` : "No reviews yet"}
            </p>
          </div>

          <div className="space-y-1.5">
            {[5, 4, 3, 2, 1].map((star) => {
              const pct = total ? Math.round((counts[star] / total) * 100) : 0;
              return (
                <div key={star} className="flex items-center gap-2">
                  <span className="w-8 shrink-0 text-[11px] font-semibold text-muted-foreground">{star} ★</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-accent">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-7 shrink-0 text-right text-[11px] text-muted-foreground">{counts[star]}</span>
                </div>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          onPointerEnter={() => { importWriteReviewDialog().catch(() => {}); }}
          onTouchStart={() => { importWriteReviewDialog().catch(() => {}); }}
          onClick={() => setWriting(true)}

          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-foreground py-3 text-sm font-bold uppercase tracking-wide text-foreground transition-colors hover:bg-accent active:scale-[0.99]"
        >
          <PenLine className="h-4 w-4" /> Write a review
        </button>
      </div>


      {writing && (
        <Suspense
          fallback={
            <div className="fixed inset-0 z-[2147483100] flex items-center justify-center bg-foreground/60">
              <span className="h-8 w-8 animate-spin rounded-full border-2 border-background border-t-transparent" />
            </div>
          }
        >

          <WriteReviewDialog
            productId={productId}
            storeId={storeId}
            productName={productName}
            onClose={() => setWriting(false)}
            onSubmitted={() => refetch()}
          />
        </Suspense>
      )}

      {galleryIndex !== null && gallery.length > 0 && (
        <Suspense fallback={null}>
          <ReviewMediaLightbox media={gallery} startIndex={galleryIndex} onClose={() => setGalleryIndex(null)} />
        </Suspense>
      )}



    </section>
  );
}
