import { useMemo, useState, lazy, Suspense } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { storefrontPath } from "@/lib/subdomain";
import { ArrowLeft, ImageIcon, Loader2 } from "lucide-react";
import type { StoreData } from "@/layouts/StorefrontLayout";
import ReviewCard, { ReviewStars } from "@/components/storefront/reviews/ReviewCard";
import { useMetaTags } from "@/hooks/useMetaTags";
import { useStoreReviews } from "@/hooks/useStoreReviews";

const ReviewMediaLightbox = lazy(() => import("@/components/storefront/reviews/ReviewMediaLightbox"));

type SortKey = "recent" | "highest" | "lowest" | "media";

export default function StorefrontReviews() {
  const store = useOutletContext<StoreData>();
  const navigate = useNavigate();
  const [sort, setSort] = useState<SortKey>("recent");
  const [starFilter, setStarFilter] = useState<number | null>(null);
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null);

  useMetaTags({ title: `Customer Reviews — ${store.name}`, storeSlug: store.slug, customDomain: store.custom_domain, canonicalPath: "reviews" });

  const { reviews, counts, total, average, isLoading } = useStoreReviews(store?.id, 1000);

  const gallery = useMemo(() => reviews.flatMap((r) => r.media), [reviews]);

  const visible = useMemo(() => {
    let list = starFilter ? reviews.filter((r) => r.rating === starFilter) : [...reviews];
    if (sort === "highest") list.sort((a, b) => b.rating - a.rating);
    else if (sort === "lowest") list.sort((a, b) => a.rating - b.rating);
    else if (sort === "media") list.sort((a, b) => b.media.length - a.media.length);
    // "recent" intentionally retains the canonical featured-first order from
    // the shared review feed, then newest approved reviews.
    return list;
  }, [reviews, starFilter, sort]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <button
        type="button"
        onClick={() => {
          if (window.history.length > 1) navigate(-1);
          else navigate(storefrontPath(store.slug));
        }}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <h1 className="text-2xl font-black text-foreground sm:text-3xl">Customer reviews</h1>
      <p className="mt-1 text-sm text-muted-foreground">What shoppers say about {store.name}</p>

      <div className="mt-5 grid gap-5 rounded-2xl border border-border p-5 sm:grid-cols-[auto_1fr] sm:items-center">
        <div className="text-center sm:text-left">
          <div className="text-4xl font-black leading-none text-foreground">{total ? average.toFixed(1) : "—"}</div>
          <div className="mt-1.5 flex justify-center sm:justify-start">
            <ReviewStars rating={average} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {total > 0 ? `Based on ${total} review${total > 1 ? "s" : ""}` : "No reviews yet"}
          </p>
        </div>
        <div className="space-y-1.5">
          {[5, 4, 3, 2, 1].map((star) => {
            const pct = total ? Math.round((counts[star] / total) * 100) : 0;
            return (
              <button
                key={star}
                onClick={() => setStarFilter(starFilter === star ? null : star)}
                className={`flex w-full items-center gap-2 rounded-md px-1 py-0.5 transition-colors ${starFilter === star ? "bg-accent" : "hover:bg-accent/60"}`}
              >
                <span className="w-8 shrink-0 text-[11px] font-semibold text-muted-foreground">{star} ★</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-accent">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                </div>
                <span className="w-7 shrink-0 text-right text-[11px] text-muted-foreground">{counts[star]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {gallery.length > 0 && (
        <div className="mt-6">
          <div className="mb-2 flex items-center gap-1.5 text-sm font-bold text-foreground">
            <ImageIcon className="h-4 w-4" /> Photos & videos from customers
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {gallery.slice(0, 30).map((m, i) => (
              <button
                key={`${m.url}-${i}`}
                onClick={() => setGalleryIndex(i)}
                className="h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-border"
                aria-label="View media"
              >
                {m.type === "video" ? (
                  <video src={m.url} className="h-full w-full object-cover" muted playsInline preload="metadata" />
                ) : (
                  <img src={m.url} alt="Customer review" loading="lazy" className="h-full w-full object-cover" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {([
          ["recent", "Most recent"],
          ["highest", "Highest rated"],
          ["lowest", "Lowest rated"],
          ["media", "With photos"],
        ] as [SortKey, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setSort(key)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              sort === key ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:bg-accent"
            }`}
          >
            {label}
          </button>
        ))}
        {starFilter && (
          <button onClick={() => setStarFilter(null)} className="text-xs font-semibold text-muted-foreground underline">
            Clear {starFilter}★ filter
          </button>
        )}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading && (
          <div className="col-span-full flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {!isLoading && visible.length === 0 && (
          <p className="col-span-full rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No reviews to show yet.
          </p>
        )}
        {visible.map((r) => (
          <ReviewCard key={r.id} review={r} />
        ))}
      </div>

      {galleryIndex !== null && (
        <Suspense fallback={null}>
          <ReviewMediaLightbox media={gallery} startIndex={galleryIndex} onClose={() => setGalleryIndex(null)} />
        </Suspense>
      )}
    </div>
  );
}
