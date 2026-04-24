-- Tier 1 performance indexes (safe, additive only)

-- #2: product_reviews — eliminate seq scans on PDP review fetches
CREATE INDEX IF NOT EXISTS idx_product_reviews_product_id
  ON public.product_reviews (product_id);

CREATE INDEX IF NOT EXISTS idx_product_reviews_store_id
  ON public.product_reviews (store_id);

-- #3: store_pages — partial index for active-page lookups on storefront shell
CREATE INDEX IF NOT EXISTS idx_store_pages_store_active
  ON public.store_pages (store_id)
  WHERE is_active = true;
