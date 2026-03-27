
-- Product reviews table
CREATE TABLE public.product_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  customer_name text NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text text,
  is_verified boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;

-- Anyone can view reviews
CREATE POLICY "Anyone can view reviews"
  ON public.product_reviews FOR SELECT
  TO public
  USING (true);

-- Anyone can insert reviews (public storefront)
CREATE POLICY "Anyone can insert reviews"
  ON public.product_reviews FOR INSERT
  TO public
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.stores
      WHERE stores.id = product_reviews.store_id AND stores.is_suspended = false
    )
  );

-- Store owners can delete reviews
CREATE POLICY "Store owners can delete reviews"
  ON public.product_reviews FOR DELETE
  TO authenticated
  USING (is_store_owner(store_id));
