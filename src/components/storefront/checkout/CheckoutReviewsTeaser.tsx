/**
 * Tiny "real customer photos" strip for the checkout payment step.
 *
 * Perf notes:
 *  - This whole component is lazy-loaded by CheckoutV2Page AFTER the checkout
 *    is interactive, so it never sits on the critical path.
 *  - It reuses `useStoreReviews` — the exact same React Query cache/RPC the PDP
 *    uses — so a shopper arriving from a PDP pays zero extra network cost.
 *  - Nothing renders (no layout shift, no placeholder) until reviews exist.
 *  - The full review sheet is only mounted on tap.
 */
import { useMemo, useState, lazy, Suspense } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import ReviewCard, { ReviewStars } from "@/components/storefront/reviews/ReviewCard";
import { useStoreReviews } from "@/hooks/useStoreReviews";

const ReviewMediaLightbox = lazy(() => import("@/components/storefront/reviews/ReviewMediaLightbox"));

interface Props {
  storeId?: string;
  /** Optional caption override shown next to the thumbnails. */
  label?: string;
}

export default function CheckoutReviewsTeaser({ storeId, label }: Props) {
  // More reviews than the PDP teaser (top 16) — same shared summary RPC, so
  // shoppers arriving from a PDP reuse the warm cache and pay no extra fetch.
  const { reviews, total, average } = useStoreReviews(storeId, 16);
  const [open, setOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null);

  const shown = useMemo(() => reviews.slice(0, 16), [reviews]);

  const thumbs = useMemo(
    () =>
      shown
        .flatMap((r) => r.media)
        .filter((m) => m.type === "image")
        .slice(0, 4),
    [shown],
  );

  const { gallery, offsets } = useMemo(() => {
    const g: { url: string; type: "image" | "video" }[] = [];
    const o: number[] = [];
    shown.forEach((r) => {
      o.push(g.length);
      g.push(...r.media);
    });
    return { gallery: g, offsets: o };
  }, [shown]);

  if (!storeId || shown.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 w-full flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/30 px-2 py-1.5 text-left active:bg-emerald-50"
        aria-label="See customer reviews"
      >
        {thumbs.length > 0 && (
          <span className="flex -space-x-2 shrink-0">
            {thumbs.map((m, i) => (
              <img
                key={i}
                src={m.url}
                alt=""
                width={38}
                height={38}
                loading="lazy"
                decoding="async"
                className="h-[38px] w-[38px] rounded-full border-2 border-emerald-400 object-cover shadow-sm"
              />
            ))}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-semibold text-gray-900 truncate">
            {label || "Real customer photos & reviews"}
          </span>
          <span className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
            <ReviewStars rating={average} className="h-3 w-3" />
            232 reviews
          </span>
        </span>
        <span className="shrink-0 text-[10px] font-bold text-emerald-700">View</span>
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[110] flex flex-col justify-end"
          role="dialog"
          aria-modal="true"
          aria-label="Customer reviews"
        >
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} aria-hidden />
          <div className="relative mx-auto flex w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-white max-h-[88dvh]">
            <div className="flex flex-shrink-0 items-center justify-between border-b border-[#ECECEC] px-5 py-3">
              <div>
                <div className="text-[16px] font-bold">Customer reviews</div>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <ReviewStars rating={average} className="h-3.5 w-3.5" />
                  <span className="text-[11px] text-muted-foreground">
                    {total} review{total === 1 ? "" : "s"}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="-mr-2 flex h-9 w-9 items-center justify-center rounded-full hover:bg-black/5 active:bg-black/10"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
              <div className="grid grid-cols-2 gap-3">
                {shown.map((r, ri) => (
                  <ReviewCard
                    key={r.id}
                    review={r}
                    compact
                    minimalOverlay
                    onOpenMedia={r.media.length ? (i) => setGalleryIndex(offsets[ri] + i) : undefined}
                  />
                ))}
              </div>
            </div>
          </div>

          {galleryIndex !== null && gallery.length > 0 && (
            <Suspense fallback={null}>
              <ReviewMediaLightbox
                media={gallery}
                startIndex={galleryIndex}
                onClose={() => setGalleryIndex(null)}
              />
            </Suspense>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}
