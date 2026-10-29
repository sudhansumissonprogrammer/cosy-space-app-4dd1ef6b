import { useState } from "react";
import { BadgeCheck, Expand } from "lucide-react";
import { Button } from "@/components/ui/button";
import ReviewMediaLightbox from "./ReviewMediaLightbox";
import type { StoreReview } from "./reviewTypes";

export default function PhotoOnlyReviewCard({ review, onOpenMedia }: {
  review: StoreReview;
  onOpenMedia?: (index: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const photo = review.media[0];
  if (!photo) return null;
  return (
    <article className="relative h-full overflow-hidden rounded-lg border border-border bg-card text-card-foreground" data-photo-review={review.id}>
      <Button variant="ghost" className="block h-auto w-full rounded-none p-0 hover:bg-transparent" aria-label="View review photo"
        onClick={() => onOpenMedia ? onOpenMedia(0) : setOpen(true)}>
        <img src={photo.url} alt="Watch review photo" loading="lazy" decoding="async" width={864} height={1536} className="aspect-[9/16] h-auto w-full object-contain" />
        <span className="pointer-events-none absolute right-2 top-2 rounded-md border border-border bg-card/90 p-1.5"><Expand className="h-4 w-4" /></span>
      </Button>
      {review.is_verified && <span className="pointer-events-none absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-md bg-card/95 px-2 py-1 text-xs text-card-foreground"><BadgeCheck className="h-3.5 w-3.5 text-success" />Verified</span>}
      {open && <ReviewMediaLightbox media={review.media} startIndex={0} onClose={() => setOpen(false)} />}
    </article>
  );
}