import { useState } from "react";
import { Star, BadgeCheck, Play } from "lucide-react";
import ReviewMediaLightbox from "./ReviewMediaLightbox";
import { formatReviewDate, type StoreReview } from "./reviewTypes";

export function ReviewStars({ rating, className = "h-4 w-4" }: { rating: number; className?: string }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} className={`${className} ${s <= Math.round(rating) ? "fill-amber-400 text-amber-400" : "text-white/30"}`} />
      ))}
    </div>
  );
}

export default function ReviewCard({ review, compact = false }: { review: StoreReview; compact?: boolean }) {
  const [lightbox, setLightbox] = useState<number | null>(null);

  const media = review.media || [];
  const hero = media[0];
  const rest = media.slice(1);

  return (
    <article
      className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/20 shadow-[0_8px_32px_-8px_rgba(31,38,135,0.45)]"
      style={{ background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" }}
    >
      {hero && (
        <button
          type="button"
          onClick={() => setLightbox(0)}
          className="relative block w-full overflow-hidden transition-transform active:scale-[0.99]"
          aria-label="View media"
        >
          <div className="aspect-[4/5] w-full">
            {hero.type === "video" ? (
              <>
                <video src={hero.url} className="h-full w-full object-cover" muted playsInline preload="metadata" />
                <span className="absolute inset-0 flex items-center justify-center bg-black/25">
                  <Play className="h-9 w-9 fill-white text-white" />
                </span>
              </>
            ) : (
              <img src={hero.url} alt="Customer photo" loading="lazy" decoding="async" className="h-full w-full object-cover" />
            )}
          </div>

          {rest.length > 0 && (
            <span className="absolute right-2.5 top-2.5 rounded-full border border-white/25 bg-white/15 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur-md">
              +{rest.length}
            </span>
          )}
        </button>
      )}

      {rest.length > 0 && (
        <div className="flex gap-2 overflow-x-auto px-3 pt-3 scrollbar-hide">
          {rest.map((m, i) => (
            <button
              key={`${m.url}-${i}`}
              type="button"
              onClick={() => setLightbox(i + 1)}
              className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-white/25 transition-transform active:scale-95"
              aria-label="View media"
            >
              {m.type === "video" ? (
                <>
                  <video src={m.url} className="h-full w-full object-cover" muted playsInline preload="metadata" />
                  <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <Play className="h-4 w-4 fill-white text-white" />
                  </span>
                </>
              ) : (
                <img src={m.url} alt="Customer photo" loading="lazy" decoding="async" className="h-full w-full object-cover" />
              )}
            </button>
          ))}
        </div>
      )}

      {/* Glass panel with the review text */}
      <div
        className={`relative m-3 flex-1 rounded-2xl border border-white/20 bg-white/15 p-4 backdrop-blur-xl ${hero ? "-mt-14" : ""}`}
      >
        <div className="mb-2 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/25 bg-white/20 text-sm font-bold text-white backdrop-blur-md">
              {review.customer_name?.charAt(0)?.toUpperCase() || "C"}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-sm font-bold text-white">{review.customer_name}</span>
                {review.is_verified && <BadgeCheck className="h-4 w-4 shrink-0 text-white/90" />}
              </div>
              <span className="text-[11px] text-white/70">{formatReviewDate(review.created_at)}</span>
            </div>
          </div>
          <ReviewStars rating={review.rating} className="h-3.5 w-3.5" />
        </div>

        {review.title && <h4 className="mb-1 text-sm font-bold text-white">{review.title}</h4>}
        {review.review_text && (
          <p className={`text-sm leading-relaxed text-white/85 ${compact ? "line-clamp-4" : ""}`}>
            {review.review_text}
          </p>
        )}

        {review.products?.name && (
          <p className="mt-3 border-t border-white/20 pt-2 text-[11px] text-white/70">
            Reviewed: {review.products.name}
          </p>
        )}
      </div>

      {lightbox !== null && (
        <ReviewMediaLightbox media={review.media} startIndex={lightbox} onClose={() => setLightbox(null)} />
      )}
    </article>
  );
}
