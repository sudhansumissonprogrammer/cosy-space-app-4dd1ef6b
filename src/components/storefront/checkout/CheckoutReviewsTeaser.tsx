import { reviewCountLabel } from "@/lib/utkalCheckoutHints";
import { isUtkalContentStore } from "../../../../supabase/functions/_shared/utkalContent";
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
import { useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { BadgeCheck, ChevronRight, PenLine, X } from "lucide-react";
import { Link } from "react-router-dom";
import ReviewCard, { ReviewStars } from "@/components/storefront/reviews/ReviewCard";
import { useStoreReviews } from "@/hooks/useStoreReviews";
import { useVisibleBatch } from "@/components/storefront/reviews/useVisibleBatch";
import { Button } from "@/components/ui/button";
import { storefrontPath } from "@/lib/subdomain";

const ReviewMediaLightbox = lazy(() => import("@/components/storefront/reviews/ReviewMediaLightbox"));
const importWriteReviewDialog = () => import("@/components/storefront/reviews/WriteReviewDialog");
const WriteReviewDialog = lazy(importWriteReviewDialog);
const GlassReviewCard = lazy(() => import("@/components/storefront/reviews/GlassReviewCard"));

interface Props {
  storeId?: string;
  /** Optional caption override shown next to the thumbnails. */
  label?: string;
  limit?: number;
  productId?: string;
  productName?: string;
  storeSlug?: string;
  modernReviews?: boolean;
  /** Monotonic request retained while this component's lazy chunk loads. */
  openRequest?: number;
}

export default function CheckoutReviewsTeaser({
  storeId,
  label,
  limit = 1000,
  productId,
  productName,
  storeSlug,
  modernReviews = false,
  openRequest = 0,
}: Props) {
  // The SAME shared summary RPC the PDP uses,
  // so a shopper arriving from a PDP reuses the warm cache and pays no extra
  // fetch. The list is JSON only; no review media loads until the sheet opens.
  const { reviews, average, total } = useStoreReviews(storeId, limit);
  const [open, setOpen] = useState(false);
  const { reviews: allReviews, isFetching: allReviewsLoading } = useStoreReviews(open ? storeId : undefined, 1000);
  const [writing, setWriting] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null);
  const [thumbStart, setThumbStart] = useState(0);
  const [themeFonts, setThemeFonts] = useState<CSSProperties>({});
  const teaserRef = useRef<HTMLButtonElement | null>(null);

  const sheetRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const sheet = sheetRef.current;
    sheet?.querySelector<HTMLButtonElement>('button[aria-label="Close"]')?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && galleryIndex === null && !writing) setOpen(false);
      if (event.key !== "Tab" || galleryIndex !== null || writing || !sheet) return;
      const items = Array.from(sheet.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex="0"]'));
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first && last) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last && first) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
      teaserRef.current?.focus();
    };
  }, [open, galleryIndex, writing]);

  const shown = open && allReviews.length > 0 ? allReviews : reviews;

  const openReviews = useCallback(() => {
    const styles = teaserRef.current ? window.getComputedStyle(teaserRef.current) : null;
    const headingFont = styles?.getPropertyValue("--storefront-heading-font").trim();
    const bodyFont = styles?.getPropertyValue("--storefront-body-font").trim();
    setThemeFonts({
      ...(headingFont ? { "--review-heading-font": headingFont } : {}),
      ...(bodyFont ? { "--review-body-font": bodyFont } : {}),
    } as CSSProperties);
    setOpen(true);
  }, []);

  useEffect(() => {
    if (openRequest > 0) openReviews();
  }, [openRequest, openReviews]);

  // Cards inside the sheet mount 10 at a time while the shopper scrolls, so
  // opening it never floods the checkout with dozens of image requests.
  const { count: sheetCount, attach: attachSentinel, done: sheetDone } = useVisibleBatch(
    open ? shown.length : 0,
    10,
  );

  const photoPool = useMemo(
    () => shown.flatMap((r) => r.media).filter((m) => m.type === "image"),
    [shown],
  );
  const thumbs = useMemo(
    () => Array.from({ length: Math.min(3, photoPool.length) }, (_, i) => photoPool[(thumbStart + i) % photoPool.length]),
    [photoPool, thumbStart],
  );

  useEffect(() => {
    if (photoPool.length <= 3) return;
    const timer = window.setInterval(() => setThumbStart((index) => (index + 1) % photoPool.length), 1800);
    return () => window.clearInterval(timer);
  }, [photoPool.length]);

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
      <Button
        ref={teaserRef}
        variant="outline"
        type="button"
        onClick={openReviews}
        className={`mt-2 h-auto w-full justify-start gap-2 overflow-hidden rounded-lg border-border bg-card px-2 py-1.5 text-left text-card-foreground shadow-sm hover:bg-accent/40 ${modernReviews ? "bg-card/80 backdrop-blur-md" : ""}`}
        style={{ fontFamily: "var(--storefront-body-font, inherit)" }}
        aria-label="See customer reviews"
      >
        {thumbs.length > 0 && (
          <span className="flex -space-x-2 shrink-0" aria-hidden="true">
            {thumbs.map((m, i) => (
              <img
                key={`${thumbStart}-${m.url}-${i}`}
                src={m.url}
                alt=""
                width={38}
                height={38}
                loading="lazy"
                decoding="async"
                className="h-[38px] w-[38px] animate-in rounded-full border-2 border-card object-cover shadow-sm fade-in slide-in-from-bottom-2 duration-500 motion-reduce:animate-none"
              />
            ))}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-1 text-[10px] font-semibold leading-tight text-card-foreground sm:text-[11px]">
            <span className="truncate">{label || "Real customer reviews"}</span>
            <BadgeCheck className="h-3.5 w-3.5 shrink-0 fill-bauhaus-blue text-card" aria-label="Verified reviews" />
          </span>
          <span className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
            <ReviewStars rating={average} className="h-3 w-3" activeClassName="fill-warning text-warning" />
            <span>{reviewCountLabel(storeId, total)} reviews</span>
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1 text-[10px] font-bold text-foreground">View {modernReviews && <ChevronRight className="h-3.5 w-3.5" />}</span>
      </Button>

      {open && typeof document !== "undefined" && createPortal(
        <div
          className={`fixed inset-0 z-[110] flex flex-col justify-end ${modernReviews ? "sm:justify-center sm:p-6" : ""}`}
          role="dialog"
          aria-modal="true"
          aria-label="Customer reviews"
        >
          <div className="absolute inset-0 bg-foreground/50" onClick={() => setOpen(false)} aria-hidden />
          <div
            ref={sheetRef}
            className={`relative mx-auto flex w-full flex-col overflow-hidden rounded-t-2xl bg-background text-foreground max-h-[88dvh] ${modernReviews ? "max-w-2xl border border-border/70 bg-background/95 backdrop-blur-xl sm:rounded-lg" : "max-w-md"}`}
            style={{ ...themeFonts, fontFamily: "var(--review-body-font, var(--storefront-body-font, inherit))" }}
          >
            <div className="flex flex-shrink-0 items-center justify-between border-b border-border px-5 py-3">
              <div>
                <div className="text-[16px] font-bold" style={{ fontFamily: "var(--review-heading-font, var(--storefront-heading-font, inherit))" }}>Customer reviews</div>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <ReviewStars rating={average} className="h-3.5 w-3.5" activeClassName="fill-warning text-warning" />
                  <span className="text-xs text-muted-foreground">{reviewCountLabel(storeId, total)} reviews</span>
                </div>
                {isUtkalContentStore({ id: storeId }) && (
                  <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
                    2,000+ orders delivered across multiple PIN codes
                  </p>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="-mr-2 h-9 w-9 rounded-full"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
              <div className={`grid grid-cols-2 gap-3 ${modernReviews ? "sm:grid-cols-3" : ""}`}>
                {shown.slice(0, sheetCount).map((r, ri) => modernReviews ? (
                  <Suspense key={r.id} fallback={<div className="aspect-[4/5] animate-pulse rounded-lg bg-muted" />}>
                    <GlassReviewCard review={r} onOpenMedia={r.media.length ? (i) => setGalleryIndex(offsets[ri] + i) : undefined} />
                  </Suspense>
                ) : (
                  <ReviewCard
                    key={r.id}
                    review={r}
                    minimalOverlay
                    showFullText
                    onOpenMedia={r.media.length ? (i) => setGalleryIndex(offsets[ri] + i) : undefined}
                  />
                ))}
              </div>
              {allReviewsLoading && allReviews.length === 0 && total > reviews.length && (
                <p className="py-3 text-center text-xs text-muted-foreground" role="status">Loading all reviews…</p>
              )}
              {!sheetDone && <div ref={attachSentinel} className="h-8" aria-hidden />}
            </div>

            {productId && storeId && (
              <div className="grid grid-cols-2 gap-2 border-t border-border bg-background p-3">
                {storeSlug && (
                  <Button variant="outline" asChild>
                    <Link to={storefrontPath(storeSlug, "reviews")} onClick={() => setOpen(false)}>View all reviews</Link>
                  </Button>
                )}
                <Button
                  className={storeSlug ? "" : "col-span-2"}
                  onPointerEnter={() => { importWriteReviewDialog().catch(() => {}); }}
                  onTouchStart={() => { importWriteReviewDialog().catch(() => {}); }}
                  onClick={() => setWriting(true)}
                >
                  <PenLine className="h-4 w-4" /> Write a review
                </Button>
              </div>
            )}
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

      {writing && productId && storeId && (
        <Suspense fallback={null}>
          <WriteReviewDialog
            productId={productId}
            storeId={storeId}
            productName={productName}
            onClose={() => setWriting(false)}
            onSubmitted={() => setWriting(false)}
          />
        </Suspense>
      )}
    </>
  );
}
