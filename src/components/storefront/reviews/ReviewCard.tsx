import { useState } from "react";
import { Star, BadgeCheck, Play, Expand } from "lucide-react";
import ReviewMediaLightbox from "./ReviewMediaLightbox";
import PhotoOnlyReviewCard from "./PhotoOnlyReviewCard";
import { formatReviewDate, type StoreReview } from "./reviewTypes";

export function ReviewStars({
  rating,
  className = "h-4 w-4",
  activeClassName = "fill-emerald-500 text-emerald-500",
  inactiveClassName = "text-foreground/20",
}: {
  rating: number;
  className?: string;
  activeClassName?: string;
  inactiveClassName?: string;
}) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} className={`${className} ${s <= Math.round(rating) ? activeClassName : inactiveClassName}`} />
      ))}
    </div>
  );
}

export default function ReviewCard({
  review,
  compact = false,
  minimalOverlay = false,
  showFullText = false,
  onOpenMedia,
}: {
  review: StoreReview;
  compact?: boolean;
  /** Checkout-only presentation: keep media visible with a single-line caption. */
  minimalOverlay?: boolean;
  /** Show the complete written review below its media instead of truncating it over the photo. */
  showFullText?: boolean;
  /** When provided, media clicks open a shared gallery lightbox instead of a per-card one. */
  onOpenMedia?: (indexWithinReview: number) => void;
}) {
  const [lightbox, setLightbox] = useState<number | null>(null);

  if (review.photo_only) return <PhotoOnlyReviewCard review={review} onOpenMedia={onOpenMedia} />;

  const media = review.media || [];
  const hero = media[0];
  const rest = media.slice(1);

  const open = (i: number) => (onOpenMedia ? onOpenMedia(i) : setLightbox(i));

  // Photo-only reviews: no real name and nothing written — show only the rating.
  const genericName = !review.customer_name || /^(verified buyer|customer|anonymous)$/i.test(review.customer_name.trim());
  const anonymousPhotoOnly = genericName && !review.review_text && !review.title;

  return (
    <article className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/15 bg-neutral-900 shadow-[0_8px_28px_-10px_rgba(0,0,0,0.5)]">
      {hero ? (
        <>
          <div className="relative min-h-0 flex-1 overflow-hidden">
            {/* Full-bleed media */}
            <button
              type="button"
              onClick={() => open(0)}
              className="relative block h-full w-full overflow-hidden transition-transform active:scale-[0.99]"
              aria-label="View media"
            >
              <div className="aspect-[3/4.6] w-full">
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
              {/* enlarge affordance */}
              <span className="pointer-events-none absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-full border border-white/30 bg-black/45 backdrop-blur-sm">
                <Expand className="h-3.5 w-3.5 text-white" />
              </span>
              {/* readability scrim */}
              <span className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/80 via-black/35 to-transparent" />
            </button>


          {/* extra media thumbs — small, top-right */}
          {rest.length > 0 && (
            <div className="absolute right-2 top-2 flex flex-col gap-1.5">
              {rest.slice(0, 3).map((m, i) => (
                <button
                  key={`${m.url}-${i}`}
                  type="button"
                  onClick={() => open(i + 1)}
                  className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-white/40 shadow-md transition-transform active:scale-95"
                  aria-label="View media"
                >
                  {m.type === "video" ? (
                    <>
                      <video src={m.url} className="h-full w-full object-cover" muted playsInline preload="metadata" />
                      <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <Play className="h-3 w-3 fill-white text-white" />
                      </span>
                    </>
                  ) : (
                    <img src={m.url} alt="Customer photo" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                  )}
                  {i === 2 && rest.length > 3 && (
                    <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-[10px] font-bold text-white">
                      +{rest.length - 2}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Glass caption pinned to the bottom of the photo.
              Photo-only reviews (no name, no text) show just the rating. */}
          {minimalOverlay ? (
            <div className="pointer-events-none absolute inset-x-2 bottom-2 flex items-center gap-1.5 rounded-lg border border-white/20 bg-black/35 px-2 py-1.5 backdrop-blur-sm">
              <span className="min-w-0 flex-1 truncate text-[10px] font-semibold text-white">
                {genericName ? "Customer" : review.customer_name}
              </span>
              {review.is_verified && (
                <span className="flex shrink-0 items-center text-primary-foreground" aria-label="Verified buyer">
                  <BadgeCheck className="h-3.5 w-3.5 fill-bauhaus-blue text-primary-foreground" aria-hidden="true" />
                </span>
              )}
              <ReviewStars rating={review.rating} className="h-2 w-2" />
            </div>
          ) : anonymousPhotoOnly ? (
            <div className="pointer-events-none absolute inset-x-2 bottom-2 flex items-center justify-between rounded-xl border border-white/20 bg-white/10 px-3 py-2 backdrop-blur-md">
              <ReviewStars rating={review.rating} className="h-3.5 w-3.5" />
              <span className="text-[10px] text-white/70">{formatReviewDate(review.created_at)}</span>
            </div>
          ) : (
            <div className="pointer-events-none absolute inset-x-2 bottom-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2 backdrop-blur-md">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/25 text-[11px] font-bold text-white">
                  {review.customer_name?.charAt(0)?.toUpperCase() || "C"}
                </span>
                <span className="truncate text-[12px] font-bold text-white">{review.customer_name}</span>
                {review.is_verified && <BadgeCheck className="h-3.5 w-3.5 shrink-0 fill-[#1877F2] text-white" />}
                <span className="ml-auto shrink-0">
                  <ReviewStars rating={review.rating} className="h-3 w-3" />
                </span>
              </div>
              {!showFullText && (review.title || review.review_text) && (
                <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-white/90">
                  {review.title ? <span className="font-semibold">{review.title}. </span> : null}
                  {review.review_text}
                </p>
              )}
              <span className="mt-0.5 block text-[10px] text-white/60">{formatReviewDate(review.created_at)}</span>
            </div>
            )}
          </div>
          {showFullText && (review.title || review.review_text) && (
            <div className="border-t border-border bg-card px-3 py-2.5 text-card-foreground" style={{ fontFamily: "var(--review-body-font, var(--storefront-body-font, inherit))" }}>
              {review.title && (
                <h4 className="text-xs font-bold" style={{ fontFamily: "var(--review-heading-font, var(--storefront-heading-font, inherit))" }}>{review.title}</h4>
              )}
              {review.review_text && <p className="mt-0.5 whitespace-pre-wrap break-words text-xs leading-relaxed">{review.review_text}</p>}
              <span className="mt-1 block text-[10px] text-muted-foreground">{formatReviewDate(review.created_at)}</span>
            </div>
          )}
        </>
      ) : (
        /* Text-only review */
        <div className="flex flex-1 flex-col p-4" style={{ background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" }}>
          <div className="mb-2 flex items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/25 bg-white/20 text-sm font-bold text-white">
              {review.customer_name?.charAt(0)?.toUpperCase() || "C"}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-sm font-bold text-white">{review.customer_name}</span>
                {review.is_verified && <BadgeCheck className="h-4 w-4 shrink-0 fill-[#1877F2] text-white" />}
              </div>
              <span className="text-[10px] text-white/70">{formatReviewDate(review.created_at)}</span>
            </div>
            <span className="ml-auto">
              <ReviewStars rating={review.rating} className="h-3.5 w-3.5" />
            </span>
          </div>
          {review.title && <h4 className="mb-1 text-sm font-bold text-white">{review.title}</h4>}
          {review.review_text && (
            <p className={`text-[13px] leading-snug text-white/85 ${compact ? "line-clamp-4" : ""}`}>{review.review_text}</p>
          )}
        </div>
      )}

      {lightbox !== null && (
        <ReviewMediaLightbox media={review.media} startIndex={lightbox} onClose={() => setLightbox(null)} />
      )}
    </article>
  );
}
