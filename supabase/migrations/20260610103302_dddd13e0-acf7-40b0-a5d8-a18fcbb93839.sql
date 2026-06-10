
DROP FUNCTION IF EXISTS public.get_storefront_products_page(text, text, text, integer, integer);

CREATE OR REPLACE FUNCTION public.get_storefront_products_page(
  _slug text,
  _category text DEFAULT NULL,
  _sort text DEFAULT 'default',
  _page integer DEFAULT 0,
  _limit integer DEFAULT 20
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _store_id uuid;
  _offset integer;
  _fetch integer;
  _rows json;
  _row_count integer;
  _has_more boolean;
BEGIN
  IF _limit IS NULL OR _limit < 1 THEN _limit := 20; END IF;
  IF _limit > 100 THEN _limit := 100; END IF;
  IF _page IS NULL OR _page < 0 THEN _page := 0; END IF;
  _offset := _page * _limit;
  _fetch := _limit + 1; -- fetch one extra to detect "has more" without count(*)

  SELECT id INTO _store_id FROM public.stores
   WHERE slug = _slug AND COALESCE(is_suspended,false) = false
   LIMIT 1;
  IF _store_id IS NULL THEN
    RETURN json_build_object('products', '[]'::json, 'has_more', false);
  END IF;

  WITH base AS (
    SELECT id, category, created_at, currency, description, image_url,
           is_active, is_best_selling, is_category_pinned, category_pinned_at,
           name, price, sale_price, sku, slug, stock_quantity, store_id,
           updated_at, display_order
    FROM public.products
    WHERE store_id = _store_id
      AND is_active = true
      AND (_category IS NULL OR category = _category)
    ORDER BY
      CASE WHEN _category IS NOT NULL AND is_category_pinned THEN 0 ELSE 1 END,
      CASE WHEN _category IS NOT NULL THEN category_pinned_at END DESC NULLS LAST,
      CASE WHEN _sort = 'price-asc'  THEN COALESCE(sale_price, price) END ASC,
      CASE WHEN _sort = 'price-desc' THEN COALESCE(sale_price, price) END DESC,
      CASE WHEN _sort = 'newest'     THEN created_at END DESC,
      display_order ASC,
      created_at DESC,
      id ASC
    LIMIT _fetch
    OFFSET _offset
  )
  SELECT COALESCE(json_agg(to_jsonb(b) - 'display_order'), '[]'::json), count(*)
    INTO _rows, _row_count
  FROM base b;

  _has_more := _row_count > _limit;

  IF _has_more THEN
    -- trim the extra "peek" row
    SELECT json_agg(elem) INTO _rows
    FROM (
      SELECT elem FROM json_array_elements(_rows) WITH ORDINALITY t(elem, ord)
      WHERE ord <= _limit
    ) s;
  END IF;

  RETURN json_build_object('products', COALESCE(_rows, '[]'::json), 'has_more', _has_more);
END;
$$;

REVOKE ALL ON FUNCTION public.get_storefront_products_page(text, text, text, integer, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.get_storefront_products_page(text, text, text, integer, integer) TO anon, authenticated, service_role;
