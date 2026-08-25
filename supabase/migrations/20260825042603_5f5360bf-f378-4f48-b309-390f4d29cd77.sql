-- 1) Review summary + display list in one round trip
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
  IF _limit > 100 THEN _limit := 100; END IF;

  SELECT COALESCE(json_agg(r), '[]'::json) INTO _reviews
  FROM (
    SELECT id, product_id, customer_name, rating, title, review_text,
           is_verified, created_at, media, pinned_rank, is_hidden
    FROM public.product_reviews
    WHERE store_id = _store_id AND is_hidden = false
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
  WHERE store_id = _store_id AND is_hidden = false;

  RETURN json_build_object(
    'reviews', _reviews,
    'total', COALESCE(_total, 0),
    'average', COALESCE(_avg, 0),
    'counts', _counts
  );
END;
$$;

-- 2) All three PDP carousel pools + category list in one round trip
CREATE OR REPLACE FUNCTION public.get_pdp_carousel_pools(
  _store_id uuid,
  _product_id uuid,
  _category text DEFAULT NULL,
  _limit integer DEFAULT 12
)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _cats json;
  _cat_names text[];
  _other text;
  _idx integer;
  _same json;
  _best json;
  _otherRows json;
BEGIN
  IF _limit IS NULL OR _limit < 1 THEN _limit := 12; END IF;
  IF _limit > 50 THEN _limit := 50; END IF;

  SELECT COALESCE(json_agg(c), '[]'::json),
         COALESCE(array_agg(c.name), ARRAY[]::text[])
    INTO _cats, _cat_names
  FROM (
    SELECT id, name, slug, display_order
    FROM public.categories
    WHERE store_id = _store_id AND COALESCE(is_hidden, false) = false
    ORDER BY display_order ASC NULLS LAST, name ASC
  ) c;

  IF array_length(_cat_names, 1) IS NULL THEN
    _other := NULL;
  ELSIF _category IS NULL THEN
    _other := _cat_names[1];
  ELSE
    _idx := NULL;
    FOR i IN 1..array_length(_cat_names, 1) LOOP
      IF lower(_cat_names[i]) = lower(_category) THEN _idx := i; EXIT; END IF;
    END LOOP;
    IF _idx IS NULL THEN
      SELECT n INTO _other FROM unnest(_cat_names) n WHERE lower(n) <> lower(_category) LIMIT 1;
    ELSE
      _other := _cat_names[((_idx) % array_length(_cat_names, 1)) + 1];
      IF lower(COALESCE(_other, '')) = lower(_category) THEN _other := NULL; END IF;
    END IF;
  END IF;

  SELECT COALESCE(json_agg(p), '[]'::json) INTO _same
  FROM (
    SELECT id, name, slug, price, sale_price, image_url, category, stock_quantity,
           is_best_selling, has_variants, video_url, video_poster_url
    FROM public.products
    WHERE store_id = _store_id AND is_active = true AND hidden_by_category = false
      AND id <> _product_id AND _category IS NOT NULL AND category = _category
    ORDER BY display_order ASC, created_at DESC
    LIMIT _limit
  ) p;

  SELECT COALESCE(json_agg(p), '[]'::json) INTO _best
  FROM (
    SELECT id, name, slug, price, sale_price, image_url, category, stock_quantity,
           is_best_selling, has_variants, video_url, video_poster_url
    FROM public.products
    WHERE store_id = _store_id AND is_active = true AND hidden_by_category = false
      AND id <> _product_id AND is_best_selling = true
    ORDER BY display_order ASC, created_at DESC
    LIMIT _limit
  ) p;

  SELECT COALESCE(json_agg(p), '[]'::json) INTO _otherRows
  FROM (
    SELECT id, name, slug, price, sale_price, image_url, category, stock_quantity,
           is_best_selling, has_variants, video_url, video_poster_url
    FROM public.products
    WHERE store_id = _store_id AND is_active = true AND hidden_by_category = false
      AND id <> _product_id AND _other IS NOT NULL AND category = _other
    ORDER BY display_order ASC, created_at DESC
    LIMIT _limit
  ) p;

  RETURN json_build_object(
    'categories', _cats,
    'other_category', _other,
    'same', _same,
    'best', _best,
    'other', _otherRows
  );
END;
$$;

-- 3) Footer info (public email + configured payment methods) in one round trip
CREATE OR REPLACE FUNCTION public.get_store_footer_info(_store_id uuid)
RETURNS json
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT json_build_object(
    'public_email', (SELECT owner_email FROM public.stores WHERE id = _store_id AND is_suspended = false),
    'payment_methods', COALESCE(
      (SELECT to_json(payment_methods) FROM public.store_payment_config WHERE store_id = _store_id LIMIT 1),
      '[]'::json)
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_store_review_summary(uuid, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_pdp_carousel_pools(uuid, uuid, text, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_store_footer_info(uuid) TO anon, authenticated;