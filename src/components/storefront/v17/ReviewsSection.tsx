import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Star } from "lucide-react";

function ReviewCard({ name, text, rating, product, verified }: {
  name: string; text: string; rating: number; product: string; verified?: boolean;
}) {
  return (
    <div className="min-w-[300px] max-w-[340px] flex-shrink-0 rounded-xl border bg-white p-5 space-y-3 snap-start">
      <div className="flex items-center gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} className={`h-4 w-4 ${i < rating ? "fill-yellow-400 text-yellow-400" : "text-gray-200"}`} />
        ))}
      </div>
      <p className="text-sm leading-relaxed text-gray-500 line-clamp-4">{text}</p>
      <div className="flex items-center gap-2 pt-1">
        <div
          className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold"
          style={{ backgroundColor: "var(--storefront-primary, #1B3A2D)", color: "#fff" }}
        >
          {name.charAt(0)}
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-800">{name}</p>
          {verified && <p className="text-xs text-emerald-600">✓ Verified Buyer</p>}
        </div>
      </div>
      {product && <p className="text-xs text-gray-400 border-t pt-2">Reviewed: {product}</p>}
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
    <section className="py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-2">Customer Say!</h2>
        <p className="text-center text-sm text-gray-500 mb-8">
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
