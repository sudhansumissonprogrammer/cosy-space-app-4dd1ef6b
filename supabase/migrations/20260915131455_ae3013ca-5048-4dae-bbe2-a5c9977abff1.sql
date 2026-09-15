ALTER TABLE public.product_reviews
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'approved';

ALTER TABLE public.product_reviews
  DROP CONSTRAINT IF EXISTS product_reviews_approval_status_check;
ALTER TABLE public.product_reviews
  ADD CONSTRAINT product_reviews_approval_status_check
  CHECK (approval_status IN ('pending', 'approved'));

CREATE OR REPLACE FUNCTION public.enforce_review_not_verified()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.is_verified := false;
  NEW.pinned_rank := NULL;
  IF public.is_store_owner(NEW.store_id) THEN
    NEW.approval_status := 'approved';
    NEW.is_hidden := false;
  ELSE
    NEW.approval_status := 'pending';
    NEW.is_hidden := true;
  END IF;
  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS "Anyone can view visible reviews" ON public.product_reviews;
CREATE POLICY "Anyone can view approved visible reviews"
ON public.product_reviews
FOR SELECT
USING (
  (approval_status = 'approved' AND is_hidden = false)
  OR public.is_store_owner(store_id)
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE OR REPLACE FUNCTION public.get_store_review_summary(_store_id uuid, _limit integer DEFAULT 20)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _reviews json;
  _total integer;
  _avg numeric;
  _counts json;
BEGIN
  IF _limit IS NULL OR _limit < 1 THEN _limit := 20; END IF;
  IF _limit > 1000 THEN _limit := 1000; END IF;

  SELECT COALESCE(json_agg(r), '[]'::json) INTO _reviews
  FROM (
    SELECT id, product_id, customer_name, rating, title, review_text,
           is_verified, created_at, media, pinned_rank, is_hidden, approval_status
    FROM public.product_reviews
    WHERE store_id = _store_id
      AND approval_status = 'approved'
      AND is_hidden = false
    ORDER BY pinned_rank ASC NULLS LAST, created_at DESC
    LIMIT _limit
  ) r;

  SELECT count(*)::int, COALESCE(avg(rating), 0)::numeric,
         json_build_object(
           '5', count(*) FILTER (WHERE rating = 5),
           '4', count(*) FILTER (WHERE rating = 4),
           '3', count(*) FILTER (WHERE rating = 3),
           '2', count(*) FILTER (WHERE rating = 2),
           '1', count(*) FILTER (WHERE rating = 1)
         )
    INTO _total, _avg, _counts
  FROM public.product_reviews
  WHERE store_id = _store_id
    AND approval_status = 'approved'
    AND is_hidden = false;

  RETURN json_build_object(
    'reviews', _reviews,
    'total', COALESCE(_total, 0),
    'average', COALESCE(_avg, 0),
    'counts', _counts
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_store_review_summary(uuid, integer) TO anon, authenticated;
GRANT SELECT, INSERT ON public.product_reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_reviews TO authenticated;
GRANT ALL ON public.product_reviews TO service_role;