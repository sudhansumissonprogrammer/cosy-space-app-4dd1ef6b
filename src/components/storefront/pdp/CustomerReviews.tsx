import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Star, Check, ThumbsUp } from "lucide-react";
import { hasCustomPdpSections } from "@/components/storefront/pdp/storeSections/config";
import { Link } from "react-router-dom";
import { storefrontPath } from "@/lib/subdomain";
import { useStoreReviews } from "@/hooks/useStoreReviews";

interface Props {
  productId: string;
  storeId: string;
  storeSlug: string;
}

export default function CustomerReviews({
  productId,
  storeId,
  storeSlug,
}: Props) {
  const [activeTab, setActiveTab] = useState<"reviews" | "description" | "returns">("reviews");
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formRating, setFormRating] = useState(0);
  const [formHoverRating, setFormHoverRating] = useState(0);
  const [formText, setFormText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { reviews: approvedReviews, total: approvedTotal, average: approvedAverage, counts: approvedCounts } = useStoreReviews(storeId, 12);
  const realMapped = approvedReviews.map((r) => ({
    id: r.id,
    name: r.customer_name,
    rating: r.rating,
    text: r.review_text || "",
    daysAgo: Math.max(1, Math.floor((Date.now() - new Date(r.created_at).getTime()) / 86400000)),
    verified: r.is_verified,
    helpful: 0,
    isReal: true,
  }));

  const allReviews = realMapped;
  const displayed = allReviews.slice(0, 12);
  const totalCount = approvedTotal;
  const avgRating = approvedAverage;

  const starCounts = useMemo(() => {
    return approvedCounts;
  }, [approvedCounts]);

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
      is_hidden: true,
      approval_status: "pending",
    });
    setSubmitting(false);
    if (error) {
      toast.error("Failed to submit review");
      return;
    }
    toast.success("Thanks! Your review was submitted for approval.");
    setFormName("");
    setFormRating(0);
    setFormText("");
    setShowForm(false);
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
                 const pct = totalCount > 0 ? Math.round((count / totalCount) * 100) : 0;
                return (
                  <div key={stars} className="flex items-center gap-2.5">
                    <div className="flex items-center gap-0.5 w-24 shrink-0">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className={`h-4 w-4 ${i < stars ? "fill-foreground text-foreground" : "text-muted-foreground/20"}`} />
                      ))}
                    </div>
                    <div className="flex-1 h-3 rounded-sm bg-accent overflow-hidden border border-border">
                      <div
                        className="h-full bg-amber-400 transition-[transform,opacity,colors,box-shadow] duration-500"
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
              <div key={review.id} className="rounded-xl border border-border p-4 transition-[transform,opacity,colors,box-shadow] hover:shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground" aria-hidden>
                    {review.name.charAt(0).toUpperCase()}
                  </div>
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

          {totalCount > 12 && (
            <Link to={storefrontPath(storeSlug, "reviews")} className="mt-3 inline-block text-sm font-semibold text-primary hover:underline">
              View all {totalCount} reviews →
            </Link>
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
          {hasCustomPdpSections(storeId) && (
            <p className="font-semibold text-foreground">
              • Mandatory: a clear, uncut unboxing video of the sealed parcel is required to claim
              any return, replacement or refund.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
