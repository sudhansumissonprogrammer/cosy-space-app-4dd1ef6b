ALTER TABLE public.product_reviews
  ADD COLUMN IF NOT EXISTS pinned_rank integer;

CREATE INDEX IF NOT EXISTS product_reviews_store_pinned_idx
  ON public.product_reviews (store_id, pinned_rank NULLS LAST, created_at DESC)
  WHERE is_hidden = false;