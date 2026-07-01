CREATE OR REPLACE FUNCTION public.get_store_sales_analytics(
  _store_id uuid,
  _range_start timestamp with time zone,
  _range_end timestamp with time zone,
  _prior_start timestamp with time zone,
  _prior_end timestamp with time zone
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _tz text := 'Asia/Kolkata';
  _total_revenue numeric := 0;
  _prior_revenue numeric := 0;
  _total_orders bigint := 0;
  _prior_orders bigint := 0;
  _sales_by_day jsonb := '[]'::jsonb;
  _top_products jsonb := '[]'::jsonb;
  _orders_by_status jsonb := '[]'::jsonb;
  _payment_methods jsonb := '[]'::jsonb;
BEGIN
  IF NOT (public.is_store_owner(_store_id) OR public.has_role(auth.uid(), 'admin'::public.app_role)) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT COALESCE(NULLIF(timezone, ''), 'Asia/Kolkata')
    INTO _tz
  FROM public.stores
  WHERE id = _store_id;

  WITH revenue_orders AS (
    SELECT total
    FROM public.orders
    WHERE store_id = _store_id
      AND created_at >= _range_start
      AND created_at <= _range_end
      AND status IN ('confirmed', 'shipped', 'delivered', 'partially_paid')
  )
  SELECT COALESCE(SUM(total), 0), COUNT(*)
    INTO _total_revenue, _total_orders
  FROM revenue_orders;

  WITH prior_revenue_orders AS (
    SELECT total
    FROM public.orders
    WHERE store_id = _store_id
      AND created_at >= _prior_start
      AND created_at < _prior_end
      AND status IN ('confirmed', 'shipped', 'delivered', 'partially_paid')
  )
  SELECT COALESCE(SUM(total), 0), COUNT(*)
    INTO _prior_revenue, _prior_orders
  FROM prior_revenue_orders;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'date', d.day::text,
    'revenue', d.revenue,
    'orders', d.orders
  ) ORDER BY d.day), '[]'::jsonb)
    INTO _sales_by_day
  FROM (
    SELECT
      (created_at AT TIME ZONE _tz)::date AS day,
      COALESCE(SUM(total), 0) AS revenue,
      COUNT(*)::bigint AS orders
    FROM public.orders
    WHERE store_id = _store_id
      AND created_at >= _range_start
      AND created_at <= _range_end
      AND status IN ('confirmed', 'shipped', 'delivered', 'partially_paid')
    GROUP BY 1
    ORDER BY 1
  ) d;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'name', p.name,
    'units', p.units,
    'revenue', p.revenue
  ) ORDER BY p.revenue DESC), '[]'::jsonb)
    INTO _top_products
  FROM (
    SELECT
      COALESCE(NULLIF(oi.product_name, ''), 'Unknown product') AS name,
      COALESCE(SUM(COALESCE(oi.quantity, 1)), 0)::bigint AS units,
      COALESCE(SUM(COALESCE(oi.total, 0)), 0) AS revenue
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE o.store_id = _store_id
      AND o.created_at >= _range_start
      AND o.created_at <= _range_end
      AND o.status IN ('confirmed', 'shipped', 'delivered', 'partially_paid')
    GROUP BY 1
    ORDER BY 3 DESC
    LIMIT 8
  ) p;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'name', s.name,
    'value', s.value
  ) ORDER BY s.value DESC), '[]'::jsonb)
    INTO _orders_by_status
  FROM (
    SELECT COALESCE(NULLIF(status, ''), 'unknown') AS name, COUNT(*)::bigint AS value
    FROM public.orders
    WHERE store_id = _store_id
      AND created_at >= _range_start
      AND created_at <= _range_end
    GROUP BY 1
    ORDER BY 2 DESC
  ) s;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'name', m.name,
    'value', m.value
  ) ORDER BY m.value DESC), '[]'::jsonb)
    INTO _payment_methods
  FROM (
    SELECT COALESCE(NULLIF(payment_method, ''), 'Unknown') AS name, COUNT(*)::bigint AS value
    FROM public.orders
    WHERE store_id = _store_id
      AND created_at >= _range_start
      AND created_at <= _range_end
      AND COALESCE(status, '') <> 'cancelled'
    GROUP BY 1
    ORDER BY 2 DESC
  ) m;

  RETURN jsonb_build_object(
    'total_revenue', COALESCE(_total_revenue, 0),
    'prior_revenue', COALESCE(_prior_revenue, 0),
    'total_orders', COALESCE(_total_orders, 0),
    'prior_orders', COALESCE(_prior_orders, 0),
    'sales_by_day', COALESCE(_sales_by_day, '[]'::jsonb),
    'top_products', COALESCE(_top_products, '[]'::jsonb),
    'orders_by_status', COALESCE(_orders_by_status, '[]'::jsonb),
    'payment_methods', COALESCE(_payment_methods, '[]'::jsonb)
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_store_sales_analytics(uuid, timestamp with time zone, timestamp with time zone, timestamp with time zone, timestamp with time zone) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_analytics_traffic(
  _store_id uuid,
  _range_start timestamp with time zone,
  _range_end timestamp with time zone,
  _prior_start timestamp with time zone,
  _prior_end timestamp with time zone
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _tz text := 'Asia/Kolkata';
  _today date;
  _sessions bigint := 0;
  _visitors bigint := 0;
  _pageviews bigint := 0;
  _prior_sessions bigint := 0;
  _prior_visitors bigint := 0;
  _prior_pageviews bigint := 0;
BEGIN
  IF NOT (public.is_store_owner(_store_id) OR public.has_role(auth.uid(), 'admin'::public.app_role)) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT COALESCE(NULLIF(timezone, ''), 'Asia/Kolkata')
    INTO _tz
  FROM public.stores
  WHERE id = _store_id;

  _today := (now() AT TIME ZONE COALESCE(_tz, 'Asia/Kolkata'))::date;

  WITH current_rollup AS (
    SELECT
      COALESCE(SUM(sessions), 0)::bigint AS sessions,
      COALESCE(SUM(visitors), 0)::bigint AS visitors,
      COALESCE(SUM(pageviews), 0)::bigint AS pageviews
    FROM public.page_views_daily
    WHERE store_id = _store_id
      AND date >= (_range_start AT TIME ZONE _tz)::date
      AND date <= LEAST((_range_end AT TIME ZONE _tz)::date, _today - 1)
  ),
  current_raw AS (
    SELECT
      COUNT(DISTINCT COALESCE(NULLIF(session_id, ''), NULLIF(visitor_id, '')))::bigint AS sessions,
      COUNT(DISTINCT COALESCE(NULLIF(visitor_id, ''), NULLIF(session_id, '')))::bigint AS visitors,
      COUNT(*)::bigint AS pageviews
    FROM public.page_views
    WHERE store_id = _store_id
      AND created_at >= GREATEST(_range_start, (_today::timestamp AT TIME ZONE _tz))
      AND created_at <= _range_end
      AND COALESCE(is_bot, false) = false
  )
  SELECT
    current_rollup.sessions + current_raw.sessions,
    current_rollup.visitors + current_raw.visitors,
    current_rollup.pageviews + current_raw.pageviews
  INTO _sessions, _visitors, _pageviews
  FROM current_rollup, current_raw;

  WITH prior_rollup AS (
    SELECT
      COALESCE(SUM(sessions), 0)::bigint AS sessions,
      COALESCE(SUM(visitors), 0)::bigint AS visitors,
      COALESCE(SUM(pageviews), 0)::bigint AS pageviews
    FROM public.page_views_daily
    WHERE store_id = _store_id
      AND date >= (_prior_start AT TIME ZONE _tz)::date
      AND date <= LEAST((_prior_end AT TIME ZONE _tz)::date, _today - 1)
  ),
  prior_raw AS (
    SELECT
      COUNT(DISTINCT COALESCE(NULLIF(session_id, ''), NULLIF(visitor_id, '')))::bigint AS sessions,
      COUNT(DISTINCT COALESCE(NULLIF(visitor_id, ''), NULLIF(session_id, '')))::bigint AS visitors,
      COUNT(*)::bigint AS pageviews
    FROM public.page_views
    WHERE store_id = _store_id
      AND created_at >= GREATEST(_prior_start, (_today::timestamp AT TIME ZONE _tz))
      AND created_at <= _prior_end
      AND COALESCE(is_bot, false) = false
  )
  SELECT
    prior_rollup.sessions + prior_raw.sessions,
    prior_rollup.visitors + prior_raw.visitors,
    prior_rollup.pageviews + prior_raw.pageviews
  INTO _prior_sessions, _prior_visitors, _prior_pageviews
  FROM prior_rollup, prior_raw;

  RETURN jsonb_build_object(
    'sessions', COALESCE(_sessions, 0),
    'visitors', COALESCE(_visitors, 0),
    'pageviews', COALESCE(_pageviews, 0),
    'prior_sessions', COALESCE(_prior_sessions, 0),
    'prior_visitors', COALESCE(_prior_visitors, 0),
    'prior_pageviews', COALESCE(_prior_pageviews, 0)
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_analytics_traffic(uuid, timestamp with time zone, timestamp with time zone, timestamp with time zone, timestamp with time zone) TO authenticated;