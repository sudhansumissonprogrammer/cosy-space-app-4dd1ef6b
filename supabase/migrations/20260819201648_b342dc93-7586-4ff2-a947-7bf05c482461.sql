-- 1) Monthly sales in one pass (replaces 12 per-month RPC calls)
DROP FUNCTION IF EXISTS public.get_store_monthly_sales(uuid, integer);
CREATE FUNCTION public.get_store_monthly_sales(_store_id uuid, _months integer DEFAULT 12)
RETURNS TABLE(month text, orders bigint, revenue numeric)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _tz text := 'Asia/Kolkata';
  _n int := GREATEST(LEAST(COALESCE(_months, 12), 36), 1);
BEGIN
  IF NOT (public.is_store_owner(_store_id) OR public.has_role(auth.uid(), 'admin'::public.app_role)) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT COALESCE(NULLIF(s.timezone, ''), 'Asia/Kolkata') INTO _tz
  FROM public.stores s WHERE s.id = _store_id;

  RETURN QUERY
  SELECT to_char(d.m, 'YYYY-MM') AS month,
         COALESCE(agg.orders, 0)::bigint AS orders,
         COALESCE(agg.revenue, 0)::numeric AS revenue
  FROM (
    SELECT generate_series(
      date_trunc('month', (now() AT TIME ZONE _tz)) - ((_n - 1) || ' months')::interval,
      date_trunc('month', (now() AT TIME ZONE _tz)),
      '1 month'::interval
    ) AS m
  ) d
  LEFT JOIN (
    SELECT date_trunc('month', (o.created_at AT TIME ZONE _tz)) AS m,
           COUNT(*)::bigint AS orders,
           COALESCE(SUM(o.total), 0)::numeric AS revenue
    FROM public.orders o
    WHERE o.store_id = _store_id
      AND o.created_at >= ((date_trunc('month', (now() AT TIME ZONE _tz)) - ((_n - 1) || ' months')::interval) AT TIME ZONE _tz)
      AND o.status IN ('confirmed', 'shipped', 'delivered', 'partially_paid')
    GROUP BY 1
  ) agg ON agg.m = d.m
  ORDER BY d.m;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_store_monthly_sales(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_store_monthly_sales(uuid, integer) TO service_role;

-- 2) Server-side paged/filtered product list for the dashboard Products page
DROP FUNCTION IF EXISTS public.get_products_page(uuid, text, text, text, text[], text, integer, integer);
CREATE FUNCTION public.get_products_page(
  _store_id uuid,
  _search text DEFAULT NULL,
  _status text DEFAULT NULL,       -- 'active' | 'draft' | NULL
  _stock text DEFAULT NULL,        -- 'in-stock' | 'out-of-stock' | NULL
  _categories text[] DEFAULT NULL,
  _sort text DEFAULT 'date-new',
  _limit integer DEFAULT 20,
  _offset integer DEFAULT 0
)
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

  CREATE TEMP TABLE IF NOT EXISTS _noop_gpp (x int) ON COMMIT DROP;

  WITH base AS (
    SELECT p.id, p.name, p.slug, p.image_url, p.price, p.sale_price, p.stock_quantity,
           p.is_active, p.is_best_selling, p.is_category_pinned, p.category_pinned_at,
           p.category, p.sku, p.currency, p.created_at
    FROM public.products p
    WHERE p.store_id = _store_id
      AND (_status IS NULL OR (_status = 'active' AND p.is_active) OR (_status = 'draft' AND NOT p.is_active))
      AND (_stock IS NULL
           OR (_stock = 'in-stock' AND COALESCE(p.stock_quantity, 0) > 0)
           OR (_stock = 'out-of-stock' AND COALESCE(p.stock_quantity, 0) <= 0))
      AND (_categories IS NULL OR array_length(_categories, 1) IS NULL OR p.category = ANY(_categories))
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

GRANT EXECUTE ON FUNCTION public.get_products_page(uuid, text, text, text, text[], text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_products_page(uuid, text, text, text, text[], text, integer, integer) TO service_role;

-- 3) Trigram indexes so order search by name/phone is index-backed
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS orders_customer_name_trgm_idx ON public.orders USING gin (customer_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS orders_customer_phone_trgm_idx ON public.orders USING gin (customer_phone gin_trgm_ops);
