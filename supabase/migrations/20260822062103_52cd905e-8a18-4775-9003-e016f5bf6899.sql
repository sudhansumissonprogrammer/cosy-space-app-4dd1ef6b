CREATE OR REPLACE FUNCTION public.get_today_analytics(_store_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _tz text;
  _start timestamptz;
  _orders int := 0;
  _revenue numeric := 0;
  _sessions int := 0;
  _visitors int := 0;
  _pageviews int := 0;
BEGIN
  IF NOT (public.is_store_owner(_store_id) OR public.has_role(auth.uid(), 'admin'::public.app_role)) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT COALESCE(NULLIF(timezone, ''), 'Asia/Kolkata') INTO _tz FROM public.stores WHERE id = _store_id;
  _start := (date_trunc('day', now() AT TIME ZONE COALESCE(_tz, 'Asia/Kolkata')) AT TIME ZONE COALESCE(_tz, 'Asia/Kolkata'));

  -- Full order value counts as revenue, including part-paid orders.
  SELECT COUNT(*)::int, COALESCE(SUM(COALESCE(total, 0)), 0)
  INTO _orders, _revenue
  FROM public.orders
  WHERE store_id = _store_id AND created_at >= _start
    AND status IN ('confirmed', 'shipped', 'delivered', 'partially_paid', 'paid', 'completed');

  SELECT COUNT(*)::int,
         COUNT(DISTINCT COALESCE(NULLIF(session_id, ''), NULLIF(visitor_id, '')))::int,
         COUNT(DISTINCT COALESCE(NULLIF(visitor_id, ''), NULLIF(session_id, '')))::int
  INTO _pageviews, _sessions, _visitors
  FROM public.page_views
  WHERE store_id = _store_id AND created_at >= _start AND COALESCE(is_bot, false) = false;

  RETURN jsonb_build_object('orders', _orders, 'revenue', _revenue, 'sessions', _sessions,
                            'visitors', _visitors, 'pageviews', _pageviews, 'today_start', _start);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_store_sales_analytics(_store_id uuid, _range_start timestamp with time zone, _range_end timestamp with time zone, _prior_start timestamp with time zone, _prior_end timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
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

  SELECT COALESCE(NULLIF(timezone, ''), 'Asia/Kolkata') INTO _tz
  FROM public.stores WHERE id = _store_id;

  -- Revenue = full order value (part-paid orders count in full).
  SELECT COALESCE(SUM(COALESCE(total, 0)), 0), COUNT(*)
    INTO _total_revenue, _total_orders
  FROM public.orders
  WHERE store_id = _store_id
    AND created_at >= _range_start
    AND created_at <= _range_end
    AND status IN ('confirmed', 'shipped', 'delivered', 'partially_paid', 'paid', 'completed');

  SELECT COALESCE(SUM(COALESCE(total, 0)), 0), COUNT(*)
    INTO _prior_revenue, _prior_orders
  FROM public.orders
  WHERE store_id = _store_id
    AND created_at >= _prior_start
    AND created_at < _prior_end
    AND status IN ('confirmed', 'shipped', 'delivered', 'partially_paid', 'paid', 'completed');

  SELECT COALESCE(jsonb_agg(jsonb_build_object('date', d.day::text, 'revenue', d.revenue, 'orders', d.orders) ORDER BY d.day), '[]'::jsonb)
    INTO _sales_by_day
  FROM (
    SELECT (created_at AT TIME ZONE _tz)::date AS day,
           COALESCE(SUM(COALESCE(total, 0)), 0) AS revenue,
           COUNT(*)::bigint AS orders
    FROM public.orders
    WHERE store_id = _store_id
      AND created_at >= _range_start
      AND created_at <= _range_end
      AND status IN ('confirmed', 'shipped', 'delivered', 'partially_paid', 'paid', 'completed')
    GROUP BY 1 ORDER BY 1
  ) d;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('name', p.name, 'units', p.units, 'revenue', p.revenue) ORDER BY p.revenue DESC), '[]'::jsonb)
    INTO _top_products
  FROM (
    SELECT COALESCE(NULLIF(oi.product_name, ''), 'Unknown product') AS name,
           COALESCE(SUM(COALESCE(oi.quantity, 1)), 0)::bigint AS units,
           COALESCE(SUM(COALESCE(oi.total, 0)), 0) AS revenue
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE o.store_id = _store_id
      AND o.created_at >= _range_start
      AND o.created_at <= _range_end
      AND o.status IN ('confirmed', 'shipped', 'delivered', 'partially_paid', 'paid', 'completed')
    GROUP BY 1 ORDER BY 3 DESC LIMIT 8
  ) p;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('name', s.name, 'value', s.value) ORDER BY s.value DESC), '[]'::jsonb)
    INTO _orders_by_status
  FROM (
    SELECT COALESCE(NULLIF(status, ''), 'unknown') AS name, COUNT(*)::bigint AS value
    FROM public.orders
    WHERE store_id = _store_id AND created_at >= _range_start AND created_at <= _range_end
    GROUP BY 1 ORDER BY 2 DESC
  ) s;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('name', m.name, 'value', m.value) ORDER BY m.value DESC), '[]'::jsonb)
    INTO _payment_methods
  FROM (
    SELECT COALESCE(NULLIF(payment_method, ''), 'Unknown') AS name, COUNT(*)::bigint AS value
    FROM public.orders
    WHERE store_id = _store_id AND created_at >= _range_start AND created_at <= _range_end
      AND COALESCE(status, '') <> 'cancelled'
    GROUP BY 1 ORDER BY 2 DESC
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

CREATE OR REPLACE FUNCTION public.get_analytics_orders_breakdown(_store_id uuid, _range_start timestamp with time zone, _range_end timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _res jsonb;
BEGIN
  IF NOT (public.is_store_owner(_store_id) OR public.has_role(auth.uid(), 'admin'::public.app_role)) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  WITH o AS (
    SELECT status,
           COALESCE(is_repeat_customer, false) AS repeat_c,
           COALESCE(total, 0) AS rev,
           status IN ('confirmed','shipped','delivered','partially_paid','paid','completed') AS is_paid,
           CASE
             WHEN NULLIF(attribution->>'utm_source', '') IS NOT NULL THEN lower(left(attribution->>'utm_source', 40))
             WHEN NULLIF(attribution->>'fbclid', '') IS NOT NULL THEN 'meta-ad'
             WHEN NULLIF(attribution->>'gclid', '') IS NOT NULL THEN 'google-ad'
             WHEN NULLIF(attribution->>'ttclid', '') IS NOT NULL THEN 'tiktok-ad'
             WHEN NULLIF(attribution->>'referrer', '') IS NOT NULL THEN 'referral'
             ELSE 'direct' END AS src
    FROM public.orders
    WHERE store_id = _store_id AND created_at >= _range_start AND created_at <= _range_end
  )
  SELECT jsonb_build_object(
    'created', (SELECT COUNT(*) FROM o),
    'paid', (SELECT COUNT(*) FROM o WHERE is_paid),
    'cancelled', (SELECT COUNT(*) FROM o WHERE status IN ('cancelled','failed')),
    'pending', (SELECT COUNT(*) FROM o WHERE NOT is_paid AND status NOT IN ('cancelled','failed')),
    'paid_new', (SELECT COUNT(*) FROM o WHERE is_paid AND NOT repeat_c),
    'paid_repeat', (SELECT COUNT(*) FROM o WHERE is_paid AND repeat_c),
    'rev_new', (SELECT COALESCE(SUM(rev),0) FROM o WHERE is_paid AND NOT repeat_c),
    'rev_repeat', (SELECT COALESCE(SUM(rev),0) FROM o WHERE is_paid AND repeat_c),
    'lost_revenue', (SELECT COALESCE(SUM(COALESCE(rev,0)),0) FROM o WHERE status IN ('cancelled','failed')),
    'sources', (SELECT COALESCE(jsonb_agg(jsonb_build_object('source', x.src, 'orders', x.orders, 'revenue', x.revenue) ORDER BY x.revenue DESC), '[]'::jsonb)
                FROM (SELECT src, COUNT(*)::bigint AS orders, COALESCE(SUM(rev),0) AS revenue
                      FROM o WHERE is_paid GROUP BY 1 ORDER BY 3 DESC LIMIT 10) x)
  ) INTO _res;

  RETURN COALESCE(_res, '{}'::jsonb);
END;
$function$;

CREATE OR REPLACE FUNCTION public.rollup_customer_cohorts_monthly(_months_back integer DEFAULT 13)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  rows_written integer := 0;
BEGIN
  DELETE FROM public.customer_cohorts_monthly
  WHERE cohort_month >= date_trunc('month', CURRENT_DATE - (_months_back || ' months')::interval)::date;

  WITH base AS (
    SELECT
      store_id,
      COALESCE(NULLIF(regexp_replace(COALESCE(customer_phone, ''), '\D', '', 'g'), ''),
               'name:' || lower(trim(COALESCE(customer_name, '')))) AS cust_key,
      created_at,
      COALESCE(total, 0) AS rev
    FROM public.orders
    WHERE status IN ('confirmed','shipped','delivered','partially_paid','paid','completed')
      AND COALESCE(NULLIF(customer_phone, ''), NULLIF(customer_name, '')) IS NOT NULL
  ),
  first_order AS (
    SELECT store_id, cust_key, date_trunc('month', MIN(created_at))::date AS cohort_month
    FROM base GROUP BY store_id, cust_key
  ),
  all_orders AS (
    SELECT b.store_id, b.cust_key, f.cohort_month,
           date_trunc('month', b.created_at)::date AS order_month, b.rev
    FROM base b
    JOIN first_order f ON f.store_id = b.store_id AND f.cust_key = b.cust_key
    WHERE f.cohort_month >= date_trunc('month', CURRENT_DATE - (_months_back || ' months')::interval)::date
  ),
  agg AS (
    SELECT store_id, cohort_month,
           ((EXTRACT(YEAR FROM age(order_month, cohort_month))*12
             + EXTRACT(MONTH FROM age(order_month, cohort_month))))::int AS period_offset,
           COUNT(DISTINCT cust_key)::int AS returning_customers,
           COALESCE(SUM(rev), 0)::numeric AS revenue
    FROM all_orders
    GROUP BY store_id, cohort_month, order_month
  ),
  cohort_size AS (
    SELECT store_id, cohort_month, COUNT(*)::int AS customers
    FROM first_order
    WHERE cohort_month >= date_trunc('month', CURRENT_DATE - (_months_back || ' months')::interval)::date
    GROUP BY store_id, cohort_month
  ),
  ins AS (
    INSERT INTO public.customer_cohorts_monthly (store_id, cohort_month, period_offset, customers, returning_customers, revenue)
    SELECT a.store_id, a.cohort_month, a.period_offset, cs.customers, a.returning_customers, a.revenue
    FROM agg a
    JOIN cohort_size cs ON cs.store_id = a.store_id AND cs.cohort_month = a.cohort_month
    RETURNING 1
  )
  SELECT count(*) INTO rows_written FROM ins;
  RETURN rows_written;
END;
$function$;