import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STAR_COLOR = "var(--v17-primary, #1B5E4B)";
const STAR_EMPTY = "color-mix(in srgb, var(--v17-text, #1a1a1a) 20%, transparent)";

function ReviewStar({ filled }: { filled: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill={filled ? STAR_COLOR : STAR_EMPTY}>
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

function ReviewCard({ name, text, rating, product, verified }: {
  name: string; text: string; rating: number; product: string; verified?: boolean;
}) {
  return (
    <div
      className="min-w-[300px] max-w-[340px] flex-shrink-0 snap-start"
      style={{
        borderRadius: "12px",
        border: "1px solid var(--v17-border, #e8e8e3)",
        backgroundColor: "var(--v17-bg, var(--storefront-bg, #fff))",
        padding: "20px",
        fontFamily: "var(--v17-body-font, 'Jost', sans-serif)",
      }}
    >
      <div className="flex items-center gap-0.5 mb-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <ReviewStar key={i} filled={i < rating} />
        ))}
      </div>
      <p style={{ fontSize: "14px", lineHeight: 1.6, color: "var(--v17-text-muted, #666)", marginBottom: "12px" }} className="line-clamp-4">{text}</p>
      <div className="flex items-center gap-2 pt-1">
        <div
          className="flex items-center justify-center rounded-full"
          style={{ width: "32px", height: "32px", backgroundColor: "var(--v17-primary, #2B4C3F)", color: "var(--v17-bg, var(--storefront-bg, #fff))", fontSize: "12px", fontWeight: 700 }}
        >
          {name.charAt(0)}
        </div>
        <div>
          <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--v17-text, #1a1a1a)" }}>{name}</p>
          {verified && <p style={{ fontSize: "12px", color: "var(--v17-primary, #1B5E4B)" }}>✓ Verified Buyer</p>}
        </div>
      </div>
      {product && <p style={{ fontSize: "12px", color: "var(--v17-text-muted, #999)", borderTop: "1px solid var(--v17-border, #e8e8e3)", paddingTop: "8px", marginTop: "12px" }}>Reviewed: {product}</p>}
    </div>
  );
}

const defaultReviews = [
  { customer_name: "Arjun K.", review_text: "Amazing quality hoodie! The fabric is so soft and the fit is perfect.", rating: 5, is_verified: true, products: { name: "Premium Hoodie" } },
  { customer_name: "Priya S.", review_text: "Loved the oversized fit. Exactly as shown in pictures. Very premium feel.", rating: 5, is_verified: true, products: { name: "Oversized Tee" } },
  { customer_name: "Rahul M.", review_text: "Fast delivery and excellent packaging. The design is unique.", rating: 4, is_verified: true, products: { name: "Graphic Hoodie" } },
];

export default function ReviewsSection({ storeId }: { storeId: string }) {
  const { data: reviews } = useQuery({
    queryKey: ["storefront-reviews-v17", storeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("product_reviews")
        .select("*, products(name)")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(10);
      return data || [];
    },
    staleTime: 5 * 60_000,
  });

  const displayReviews = reviews && reviews.length > 0 ? reviews : defaultReviews;

  return (
    <section style={{ padding: "48px 15px" }}>
      <div className="max-w-7xl mx-auto">
        <h2
          className="text-center"
          style={{
            fontFamily: "var(--v17-heading-font, 'Cormorant Garamond', serif)",
            fontSize: "clamp(24px, 4vw, 36px)",
            fontWeight: 400,
            color: "var(--v17-text, #1a1a1a)",
            marginBottom: "8px",
          }}
        >
          Customer Say!
        </h2>
        <p
          className="text-center"
          style={{
            fontFamily: "var(--v17-body-font, 'Jost', sans-serif)",
            fontSize: "14px",
            color: "var(--v17-text-muted, #666)",
            marginBottom: "30px",
          }}
        >
          Customers love our products and we always strive to please them all.
        </p>
        <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide">
          {displayReviews.map((r: any, i: number) => (
            <ReviewCard
              key={i}
              name={r.customer_name}
              text={r.review_text || "Great product!"}
              rating={r.rating}
              product={(r.products as any)?.name || ""}
              verified={r.is_verified}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
