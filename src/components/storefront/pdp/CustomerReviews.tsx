import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Star, Check, ThumbsUp } from "lucide-react";

interface FakeReview {
  id: string;
  name: string;
  rating: number;
  text: string;
  daysAgo: number;
  verified: boolean;
  helpful: number;
  avatar: string;
}

interface Props {
  reviews: FakeReview[];
  realReviews: { id: string; customer_name: string; rating: number; review_text: string | null; is_verified: boolean; created_at: string }[];
  rating: number;
  reviewCount: number;
  productId: string;
  storeId: string;
  onReviewSubmitted: () => void;
}

export default function CustomerReviews({
  reviews,
  realReviews,
  rating,
  reviewCount,
  productId,
  storeId,
  onReviewSubmitted,
}: Props) {
  const [showAll, setShowAll] = useState(false);
  const [activeTab, setActiveTab] = useState<"reviews" | "description" | "returns">("reviews");
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formRating, setFormRating] = useState(0);
  const [formHoverRating, setFormHoverRating] = useState(0);
  const [formText, setFormText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const realMapped = realReviews.map((r) => ({
    id: r.id,
    name: r.customer_name,
    rating: r.rating,
    text: r.review_text || "",
    daysAgo: Math.max(1, Math.floor((Date.now() - new Date(r.created_at).getTime()) / 86400000)),
    verified: r.is_verified,
    helpful: 0,
    avatar: `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(r.customer_name)}&backgroundColor=c0aede,d1d4f9,b6e3f4,ffd5dc,ffdfbf`,
    isReal: true,
  }));

  const allReviews = [...realMapped, ...reviews.map((r) => ({ ...r, isReal: false }))];
  const displayed = showAll ? allReviews : allReviews.slice(0, 3);
  const totalCount = reviewCount + realReviews.length;
  const avgRating =
    realReviews.length > 0
      ? (rating * reviewCount + realReviews.reduce((s, r) => s + r.rating, 0)) / totalCount
      : rating;

  const starCounts = useMemo(() => {
    const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    allReviews.forEach((r) => {
      if (counts[r.rating as keyof typeof counts] !== undefined) counts[r.rating as keyof typeof counts]++;
    });
    return counts;
  }, [allReviews]);

  const handleSubmit = async () => {
    if (!formName.trim() || formRating === 0) {
      toast.error("Please enter your name and select a rating");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("product_reviews").insert({
      product_id: productId,
      store_id: storeId,
      customer_name: formName.trim(),
      rating: formRating,
      review_text: formText.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      toast.error("Failed to submit review");
      return;
    }
    toast.success("Review submitted! Thank you 🎉");
    setFormName("");
    setFormRating(0);
    setFormText("");
    setShowForm(false);
    onReviewSubmitted();
  };

  return (
    <section className="mt-10 pt-6 border-t border-border">
      <div className="flex items-center gap-6 mb-6 border-b border-border">
        {(["reviews", "description", "returns"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-2.5 text-sm font-semibold transition-colors border-b-2 ${
              activeTab === tab
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab === "reviews" ? "Reviews" : tab === "description" ? "Description" : "Return Policy"}
          </button>
        ))}
      </div>

      {activeTab === "reviews" && (
        <div>
          <div className="rounded-xl border border-border p-5 mb-6">
            <h2 className="text-2xl font-bold text-foreground mb-2">Customer Reviews</h2>
            <div className="flex items-center gap-1 mb-1">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className={`h-5 w-5 ${i < Math.floor(avgRating) ? "fill-foreground text-foreground" : i < avgRating ? "fill-foreground/50 text-foreground" : "text-muted-foreground/30"}`} />
              ))}
            </div>
            <p className="text-sm text-muted-foreground mb-4">Based on {totalCount} reviews</p>

            <button
              onClick={() => setShowForm(!showForm)}
              className="w-full rounded-lg border border-border py-2.5 text-sm font-medium text-foreground hover:bg-accent transition-colors"
            >
              {showForm ? "Cancel" : "Write a review"}
            </button>

            {showForm && (
              <div className="mt-4 space-y-3 rounded-lg border border-border p-4 bg-accent/30 animate-in slide-in-from-top-2 duration-200">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Your Name *</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Enter your name"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    maxLength={50}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Rating *</label>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onMouseEnter={() => setFormHoverRating(star)}
                        onMouseLeave={() => setFormHoverRating(0)}
                        onClick={() => setFormRating(star)}
                        className="p-0.5 transition-transform hover:scale-110"
                      >
                        <Star
                          className={`h-7 w-7 transition-colors ${
                            star <= (formHoverRating || formRating)
                              ? "fill-amber-400 text-amber-400"
                              : "text-muted-foreground/30"
                          }`}
                        />
                      </button>
                    ))}
                    {formRating > 0 && <span className="ml-2 text-sm font-semibold text-foreground">{formRating}/5</span>}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Your Review</label>
                  <textarea
                    value={formText}
                    onChange={(e) => setFormText(e.target.value)}
                    placeholder="Share your experience with this product..."
                    rows={3}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                    maxLength={500}
                  />
                </div>
                <button
                  onClick={handleSubmit}
                  disabled={submitting || !formName.trim() || formRating === 0}
                  className="w-full rounded-lg bg-primary py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {submitting ? "Submitting..." : "Submit Review"}
                </button>
              </div>
            )}

            <div className="mt-5 space-y-2">
              {[5, 4, 3, 2, 1].map((stars) => {
                const count = starCounts[stars as keyof typeof starCounts];
                const pct = allReviews.length > 0 ? Math.round((count / allReviews.length) * 100) : 0;
                return (
                  <div key={stars} className="flex items-center gap-2.5">
                    <div className="flex items-center gap-0.5 w-24 shrink-0">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className={`h-4 w-4 ${i < stars ? "fill-foreground text-foreground" : "text-muted-foreground/20"}`} />
                      ))}
                    </div>
                    <div className="flex-1 h-3 rounded-sm bg-accent overflow-hidden border border-border">
                      <div
                        className="h-full bg-amber-400 transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-8 text-right">{pct}%</span>
                    <span className="text-xs text-muted-foreground w-6 text-right">({count})</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-3">
            {displayed.map((review) => (
              <div key={review.id} className="rounded-xl border border-border p-4 transition-all hover:shadow-sm">
                <div className="flex items-start gap-3">
                  <img src={review.avatar} alt={review.name} className="h-9 w-9 rounded-full bg-accent" loading="lazy" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-foreground">{review.name}</span>
                      {review.verified && (
                        <span className="flex items-center gap-0.5 text-[10px] font-semibold text-emerald-600">
                          <Check className="h-3 w-3" /> Verified
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground ml-auto">{review.daysAgo}d ago</span>
                    </div>
                    <div className="flex items-center gap-0.5 mt-0.5">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className={`h-3 w-3 ${i < review.rating ? "fill-foreground text-foreground" : "text-muted-foreground/20"}`} />
                      ))}
                    </div>
                    <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{review.text}</p>
                    {review.helpful > 0 && (
                      <div className="mt-1.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                        <ThumbsUp className="h-3 w-3" />
                        <span>{review.helpful} found this helpful</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {allReviews.length > 3 && !showAll && (
            <button onClick={() => setShowAll(true)} className="mt-3 text-sm font-semibold text-primary hover:underline">
              View all {allReviews.length} reviews →
            </button>
          )}
        </div>
      )}

      {activeTab === "description" && (
        <div className="text-sm text-muted-foreground leading-relaxed">
          <p>Product details and specifications are listed above in the product description section.</p>
        </div>
      )}

      {activeTab === "returns" && (
        <div className="text-sm text-muted-foreground leading-relaxed space-y-2">
          <p>• 7-day easy return policy</p>
          <p>• Product must be unused and in original packaging</p>
          <p>• Refund processed within 5-7 business days</p>
          <p>• Exchange available for size/color variants</p>
        </div>
      )}
    </section>
  );
}
