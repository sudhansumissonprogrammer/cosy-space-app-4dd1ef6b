CREATE OR REPLACE FUNCTION public.get_products_page(_store_id uuid, _search text DEFAULT NULL::text, _status text DEFAULT NULL::text, _stock text DEFAULT NULL::text, _categories text[] DEFAULT NULL::text[], _sort text DEFAULT 'date-new'::text, _limit integer DEFAULT 20, _offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _q text := NULLIF(btrim(COALESCE(_search, '')), '');
  _lim int := GREATEST(LEAST(COALESCE(_limit, 20), 200), 1);
  _off int := GREATEST(COALESCE(_offset, 0), 0);
  _total bigint := 0;
  _rows jsonb := '[]'::jsonb;
BEGIN
  IF NOT (public.is_store_owner(_store_id) OR public.has_role(auth.uid(), 'admin'::public.app_role)) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  WITH base AS (
    SELECT p.id, p.name, p.slug, p.image_url, p.price, p.sale_price, p.stock_quantity,
           p.is_active, p.is_best_selling, p.is_category_pinned, p.category_pinned_at,
           p.award_badge,
           p.category, p.sku, p.currency, p.created_at
    FROM public.products p
    WHERE p.store_id = _store_id
      AND (_status IS NULL OR (_status = 'active' AND p.is_active) OR (_status = 'draft' AND NOT p.is_active))
      AND (_stock IS NULL
           OR (_stock = 'in-stock' AND COALESCE(p.stock_quantity, 0) > 0)
           OR (_stock = 'out-of-stock' AND COALESCE(p.stock_quantity, 0) <= 0))
      AND (_categories IS NULL OR array_length(_categories, 1) IS NULL
           OR p.category = ANY(_categories)
           OR EXISTS (
                SELECT 1
                FROM public.product_categories pc
                JOIN public.categories c ON c.id = pc.category_id
                WHERE pc.product_id = p.id
                  AND c.store_id = _store_id
                  AND c.name = ANY(_categories)
              ))
      AND (_q IS NULL
           OR p.name ILIKE '%' || _q || '%'
           OR p.category ILIKE '%' || _q || '%'
           OR p.sku ILIKE '%' || _q || '%')
  ), counted AS (
    SELECT COUNT(*)::bigint AS c FROM base
  ), page AS (
    SELECT * FROM base
    ORDER BY
      CASE WHEN _sort = 'title-asc' THEN lower(name) END ASC,
      CASE WHEN _sort = 'title-desc' THEN lower(name) END DESC,
      CASE WHEN _sort = 'date-old' THEN created_at END ASC,
      CASE WHEN _sort = 'stock-high' THEN COALESCE(stock_quantity, 0) END DESC,
      CASE WHEN _sort = 'stock-low' THEN COALESCE(stock_quantity, 0) END ASC,
      CASE WHEN _sort = 'category-asc' THEN lower(COALESCE(category, 'zzzz')) END ASC,
      CASE WHEN _sort = 'category-desc' THEN lower(COALESCE(category, '')) END DESC,
      created_at DESC
    LIMIT _lim OFFSET _off
  )
  SELECT (SELECT c FROM counted),
         COALESCE((SELECT jsonb_agg(to_jsonb(page)) FROM page), '[]'::jsonb)
  INTO _total, _rows;

  RETURN jsonb_build_object('total', _total, 'rows', _rows);
END;
$function$;