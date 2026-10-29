import photo01 from "@/assets/reviews/utkal/01_1000498261.webp.asset.json";
import photo02 from "@/assets/reviews/utkal/02_1000498263.webp.asset.json";
import photo03 from "@/assets/reviews/utkal/03_1000498260.webp.asset.json";
import photo04 from "@/assets/reviews/utkal/04_1000498259.webp.asset.json";
import photo05 from "@/assets/reviews/utkal/05_1000498258.webp.asset.json";
import photo06 from "@/assets/reviews/utkal/06_1000498257.webp.asset.json";
import photo07 from "@/assets/reviews/utkal/07_1000498255.webp.asset.json";
import photo08 from "@/assets/reviews/utkal/08_1000498253.webp.asset.json";
import photo09 from "@/assets/reviews/utkal/09_1000498250.webp.asset.json";
import photo10 from "@/assets/reviews/utkal/10_1000498249.webp.asset.json";
import type { StoreReview } from "@/components/storefront/reviews/reviewTypes";

const UTKAL_ID = "ab19143d-87a9-490e-90b7-837313522782";
const photos = [photo01, photo02, photo03, photo04, photo05, photo06, photo07, photo08, photo09, photo10];

/** Merchant-supplied, unrated store photos; never used in rating aggregates. */
export function utkalPhotoReviews(storeId?: string): StoreReview[] {
  if (storeId !== UTKAL_ID) return [];
  return photos.map((photo) => ({
    id: `utkal-photo-${photo.asset_id}`,
    product_id: null,
    customer_name: "",
    rating: 0,
    photo_only: true,
    title: null,
    review_text: null,
    is_verified: false,
    created_at: photo.created_at,
    media: [{ url: photo.url, type: "image" }],
  }));
}