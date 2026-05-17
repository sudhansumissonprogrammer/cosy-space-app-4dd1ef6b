/**
 * Centralized PostgREST select() field lists for `products`.
 *
 * Goal: stop sending `description` / `cost_price` / `updated_at` etc. over
 * the wire for product CARDS that don't render them. A product row averages
 * ~810 bytes; a card needs ~280 bytes. On hot endpoints (`/shop`,
 * `/category/*`, related/FBT) this is a 60% payload cut and the single
 * largest Supabase egress saving on the SPA.
 *
 * Rules:
 *  - CARD: anything that renders in a grid tile or carousel
 *  - PDP : product detail page (includes description, meta, partial payment)
 *
 * Keep these in sync with what storefront components actually read.
 */

/** Fields needed to render a product card (grid tile, carousel, related, FBT). */
export const PRODUCT_CARD_FIELDS =
  "id,name,slug,price,sale_price,image_url,category,stock_quantity,is_best_selling";

/** Fields needed for the full PDP view (card fields + long-form content). */
export const PRODUCT_PDP_FIELDS =
  PRODUCT_CARD_FIELDS +
  ",description,sku,currency,meta_title,meta_description,og_image_url" +
  ",partial_payment_enabled,partial_payment_type,partial_payment_value";

/** Fields for product_reviews list on PDP. */
export const PRODUCT_REVIEW_FIELDS =
  "id,customer_name,rating,review_text,is_verified,created_at";
