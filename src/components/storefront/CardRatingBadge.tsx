import { memo, useEffect, useState } from "react";
import { getCachedCardRating, requestCardRating, type CardRating } from "@/lib/cardRatingLookup";
import { getProductStats } from "@/lib/productUtils";

/** Ecommerce trust green (Trustpilot / Flipkart style) */
const TRUST_GREEN = "#00A264";

interface Props {
  productId: string;
  /** Optional font size override */
  size?: number;
}

/**
 * "★ 4.7 (128)" badge for product cards.
 * Uses real `product_reviews` aggregates when the product has any (batched,
 * one request per grid), otherwise the deterministic fallback so the row
 * never pops in/out and no layout shift occurs.
 */
function CardRatingBadgeInner({ productId, size = 11 }: Props) {
  const [real, setReal] = useState<CardRating | undefined>(() => getCachedCardRating(productId));

  useEffect(() => {
    if (real !== undefined) return;
    return requestCardRating(productId, setReal);
  }, [productId, real]);

  const fallback = getProductStats(productId);
  const rating = real?.rating ?? fallback.rating;
  const count = real?.count ?? fallback.reviewCount;

  return (
    <div className="mt-1 flex items-center gap-1" aria-label={`Rated ${rating} out of 5 from ${count} reviews`}>
      <span
        className="inline-flex items-center gap-0.5 rounded-[3px] px-1 py-[1px] font-semibold text-white"
        style={{ backgroundColor: TRUST_GREEN, fontSize: size }}
      >
        {rating.toFixed(1)}
        <svg viewBox="0 0 20 20" fill="currentColor" style={{ height: size - 1, width: size - 1 }} aria-hidden="true">
          <path d="M10 15.27L16.18 19l-1.64-7.03L20 7.24l-7.19-.61L10 0 7.19 6.63 0 7.24l5.46 4.73L3.82 19z" />
        </svg>
      </span>
      <span
        style={{ fontSize: size, color: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 50%, transparent)" }}
      >
        ({count.toLocaleString("en-IN")})
      </span>
    </div>
  );
}

const CardRatingBadge = memo(CardRatingBadgeInner);
export default CardRatingBadge;
