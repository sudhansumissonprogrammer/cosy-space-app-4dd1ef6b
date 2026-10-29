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
import photo11 from "@/assets/reviews/utkal/01-1000498247.webp.asset.json";
import photo12 from "@/assets/reviews/utkal/02-1000498246.webp.asset.json";
import photo13 from "@/assets/reviews/utkal/03-1000498245.webp.asset.json";
import photo14 from "@/assets/reviews/utkal/04-1000498243.webp.asset.json";
import photo15 from "@/assets/reviews/utkal/05-1000498242.webp.asset.json";
import photo16 from "@/assets/reviews/utkal/06-1000498241.webp.asset.json";
import photo17 from "@/assets/reviews/utkal/07-1000498240.webp.asset.json";
import photo18 from "@/assets/reviews/utkal/08-1000498239.webp.asset.json";
import photo19 from "@/assets/reviews/utkal/09-1000498235.webp.asset.json";
import photo20 from "@/assets/reviews/utkal/10-1000498236.webp.asset.json";
import photo21 from "@/assets/reviews/utkal/01-1000498272_utkalwatch.webp.asset.json";
import photo22 from "@/assets/reviews/utkal/02-1000498271_utkalwatch.webp.asset.json";
import photo23 from "@/assets/reviews/utkal/03-1000498270_utkalwatch.webp.asset.json";
import photo24 from "@/assets/reviews/utkal/04-1000498269_utkalwatch.webp.asset.json";
import photo25 from "@/assets/reviews/utkal/05-1000498266_utkalwatch.webp.asset.json";
import photo26 from "@/assets/reviews/utkal/06-1000498265_utkalwatch.webp.asset.json";
import photo27 from "@/assets/reviews/utkal/07-1000498267_utkalwatch.webp.asset.json";
import photo28 from "@/assets/reviews/utkal/08-1000498268_utkalwatch.webp.asset.json";
import photo29 from "@/assets/reviews/utkal/09-1000498264_utkalwatch.webp.asset.json";
import photo30 from "@/assets/reviews/utkal/10-1000498262_utkalwatch.webp.asset.json";
import type { StoreReview } from "@/components/storefront/reviews/reviewTypes";

const UTKAL_ID = "ab19143d-87a9-490e-90b7-837313522782";
const photos = [photo01, photo02, photo03, photo04, photo05, photo06, photo07, photo08, photo09, photo10,
  photo11, photo12, photo13, photo14, photo15, photo16, photo17, photo18, photo19, photo20,
  photo21, photo22, photo23, photo24, photo25, photo26, photo27, photo28, photo29, photo30];

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