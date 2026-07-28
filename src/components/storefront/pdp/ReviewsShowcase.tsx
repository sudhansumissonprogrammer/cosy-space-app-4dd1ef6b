import { useMemo, useState, lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { storefrontPath } from "@/lib/subdomain";
import { PenLine, ChevronRight } from "lucide-react";
import ReviewCard, { ReviewStars } from "@/components/storefront/reviews/ReviewCard";
import { REVIEW_SELECT, normalizeReview, ratingBreakdown, type StoreReview } from "@/components/storefront/reviews/reviewTypes";

const WriteReviewDialog = lazy(() => import("@/components/storefront/reviews/WriteReviewDialog"));

interface Props {
  productId: string;
  storeId: string;
  storeSlug: string;
  productName?: string;
}

export default function ReviewsShowcase({ productId, storeId, storeSlug, productName }: Props) {
  const [writing, setWriting] = useState(false);

  // Store-wide reviews — the same trusted social proof shows on every product page.
  const { data, refetch } = useQuery({
    queryKey: ["store-pdp-reviews", storeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("product_reviews")
        .select(REVIEW_SELECT)
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(30);
      return (data || []).map(normalizeReview) as StoreReview[];
    },
    enabled: !!storeId,
    staleTime: 5 * 60 * 1000,
  });

  const reviews = data || [];
  const { counts, total, average } = useMemo(() => ratingBreakdown(reviews), [reviews]);


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
          {reviews.slice(0, 5).map((r) => (
            <div key={r.id} className="w-[78%] shrink-0 snap-start sm:w-[46%] lg:w-[32%]">
              <ReviewCard review={r} compact />
            </div>
          ))}
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
          onClick={() => setWriting(true)}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-foreground py-3 text-sm font-bold uppercase tracking-wide text-foreground transition-colors hover:bg-accent active:scale-[0.99]"
        >
          <PenLine className="h-4 w-4" /> Write a review
        </button>
      </div>


      {writing && (
        <Suspense fallback={null}>
          <WriteReviewDialog
            productId={productId}
            storeId={storeId}
            productName={productName}
            onClose={() => setWriting(false)}
            onSubmitted={() => refetch()}
          />
        </Suspense>
      )}

    </section>
  );
}
