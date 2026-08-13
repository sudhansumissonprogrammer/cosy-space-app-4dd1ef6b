CREATE OR REPLACE FUNCTION public.store_accepts_reviews(_store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = _store_id AND s.is_suspended = false
  )
$$;

DROP POLICY IF EXISTS "Anyone can insert reviews" ON public.product_reviews;

CREATE POLICY "Anyone can insert reviews"
ON public.product_reviews
FOR INSERT
WITH CHECK (
  public.store_accepts_reviews(store_id)
  AND rating BETWEEN 1 AND 5
  AND pinned_rank IS NULL
);

GRANT SELECT, INSERT ON public.product_reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_reviews TO authenticated;
GRANT ALL ON public.product_reviews TO service_role;