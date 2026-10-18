import { BadgeCheck, Expand, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import LiquidGlass from "@/components/storefront/LiquidGlass";
import { ReviewStars } from "./ReviewCard";
import { formatReviewDate, type StoreReview } from "./reviewTypes";
import "@/styles/review-glass.css";

export default function GlassReviewCard({ review, onOpenMedia }: {
  review: StoreReview;
  onOpenMedia?: (index: number) => void;
}) {
  const hero = review.media[0];
  const name = review.customer_name?.trim() || "Customer";
  return (
    <article className="review-glass flex h-full min-w-0 flex-col overflow-hidden rounded-lg border border-border/70 text-card-foreground">
      {hero && (
        <div className="review-glass-media relative aspect-[4/5] overflow-hidden">
          <Button variant="ghost" onClick={() => onOpenMedia?.(0)} aria-label={`View ${name}'s review media`}
            className="absolute inset-0 h-full w-full rounded-none p-0 hover:bg-transparent">
            {hero.type === "video" ? (
              <><video src={hero.url} muted playsInline preload="metadata" className="h-full w-full object-contain" /><Play className="absolute h-9 w-9 fill-primary-foreground text-primary-foreground drop-shadow-md" /></>
            ) : <img src={hero.url} alt={`Jewellery photo from ${name}`} loading="lazy" decoding="async" className="h-full w-full object-contain" />}
            <span className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-lg border border-border/50 bg-card/80 text-card-foreground backdrop-blur-md"><Expand className="h-4 w-4" /></span>
          </Button>
          <LiquidGlass scale={-60} className="review-glass-caption pointer-events-none absolute inset-x-2 bottom-2 flex items-center justify-between gap-2 px-2.5 py-2">
            <ReviewStars rating={review.rating} className="h-3 w-3" activeClassName="fill-warning text-warning" inactiveClassName="text-primary-foreground/40" />
            {review.media.length > 1 && <span className="text-[10px] font-medium">+{review.media.length - 1} photos</span>}
          </LiquidGlass>
        </div>
      )}
      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground" aria-hidden>{name.charAt(0).toUpperCase()}</span>
          <div className="min-w-0 flex-1"><p className="break-words text-xs font-semibold leading-snug">{name}</p>
            {review.is_verified && <span className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground"><BadgeCheck className="h-3 w-3 text-success" />Verified buyer</span>}
          </div>
        </div>
        {!hero && <ReviewStars rating={review.rating} className="h-3 w-3" activeClassName="fill-warning text-warning" />}
        {review.title && <h3 className="break-words text-sm font-semibold leading-snug">{review.title}</h3>}
        {review.review_text && <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-card-foreground/80">{review.review_text}</p>}
        {review.media.length > 1 && <div className="flex gap-1.5">
          {review.media.slice(1, 4).map((media, index) => <Button key={`${media.url}-${index}`} variant="ghost" className="h-9 w-9 overflow-hidden rounded-md border border-border p-0" onClick={() => onOpenMedia?.(index + 1)} aria-label={`View ${name}'s additional media ${index + 1}`}>
            {media.type === "image" ? <img src={media.url} alt="Additional customer photo" loading="lazy" decoding="async" className="h-full w-full object-cover" /> : <Play className="h-3 w-3" />}
          </Button>)}
        </div>}
        <time dateTime={review.created_at} className="mt-auto pt-1 text-[10px] text-muted-foreground">{formatReviewDate(review.created_at)}</time>
      </div>
    </article>
  );
}