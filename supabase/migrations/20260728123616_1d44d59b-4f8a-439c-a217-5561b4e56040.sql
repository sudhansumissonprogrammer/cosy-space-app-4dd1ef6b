ALTER TABLE public.product_reviews
  ADD COLUMN IF NOT EXISTS media jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_product_reviews_store_created
  ON public.product_reviews (store_id, created_at DESC);

GRANT SELECT, INSERT ON public.product_reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_reviews TO authenticated;
GRANT ALL ON public.product_reviews TO service_role;

DROP POLICY IF EXISTS "Anyone can view reviews" ON public.product_reviews;
CREATE POLICY "Anyone can view visible reviews"
  ON public.product_reviews FOR SELECT
  USING (is_hidden = false OR public.is_store_owner(store_id));

DROP POLICY IF EXISTS "Store owners can update reviews" ON public.product_reviews;
CREATE POLICY "Store owners can update reviews"
  ON public.product_reviews FOR UPDATE TO authenticated
  USING (public.is_store_owner(store_id))
  WITH CHECK (public.is_store_owner(store_id));