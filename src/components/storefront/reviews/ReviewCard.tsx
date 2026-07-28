import { useState } from "react";
import { Star, BadgeCheck, Play } from "lucide-react";
import ReviewMediaLightbox from "./ReviewMediaLightbox";
import { formatReviewDate, type StoreReview } from "./reviewTypes";

export function ReviewStars({ rating, className = "h-4 w-4" }: { rating: number; className?: string }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} className={`${className} ${s <= Math.round(rating) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/25"}`} />
      ))}
    </div>
  );
}

export default function ReviewCard({ review, compact = false }: { review: StoreReview; compact?: boolean }) {
  const [lightbox, setLightbox] = useState<number | null>(null);

  return (
    <article className="rounded-2xl border border-border bg-background p-4">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-foreground">
            {review.customer_name?.charAt(0)?.toUpperCase() || "C"}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-sm font-bold text-foreground">{review.customer_name}</span>
              {review.is_verified && <BadgeCheck className="h-4 w-4 shrink-0 text-primary" />}
            </div>
            <span className="text-[11px] text-muted-foreground">{formatReviewDate(review.created_at)}</span>
          </div>
        </div>
        <ReviewStars rating={review.rating} className="h-3.5 w-3.5" />
      </div>

      {review.title && <h4 className="mb-1 text-sm font-bold text-foreground">{review.title}</h4>}
      {review.review_text && (
        <p className={`text-sm leading-relaxed text-muted-foreground ${compact ? "line-clamp-4" : ""}`}>
          {review.review_text}
        </p>
      )}

      {review.media.length > 0 && (
        <div className="mt-3 flex gap-2 overflow-x-auto scrollbar-hide">
          {review.media.map((m, i) => (
            <button
              key={m.url}
              onClick={() => setLightbox(i)}
              className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-border"
              aria-label="View media"
            >
              {m.type === "video" ? (
                <>
                  <video src={m.url} className="h-full w-full object-cover" muted playsInline preload="metadata" />
                  <span className="absolute inset-0 flex items-center justify-center bg-foreground/30">
                    <Play className="h-5 w-5 fill-background text-background" />
                  </span>
                </>
              ) : (
                <img src={m.url} alt="Customer photo" loading="lazy" className="h-full w-full object-cover" />
              )}
            </button>
          ))}
        </div>
      )}

      {review.products?.name && (
        <p className="mt-3 border-t border-border pt-2 text-[11px] text-muted-foreground">
          Reviewed: {review.products.name}
        </p>
      )}

      {lightbox !== null && (
        <ReviewMediaLightbox media={review.media} startIndex={lightbox} onClose={() => setLightbox(null)} />
      )}
    </article>
  );
}
