-- 1) Realized revenue: part-paid orders should only count the advance actually collected.
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

  SELECT COALESCE(SUM(CASE WHEN status = 'partially_paid'
                           THEN COALESCE(advance_paid, 0)
                           ELSE COALESCE(total, 0) END), 0),
         COUNT(*)
    INTO _total_revenue, _total_orders
  FROM public.orders
  WHERE store_id = _store_id
    AND created_at >= _range_start
    AND created_at <= _range_end
    AND status IN ('confirmed', 'shipped', 'delivered', 'partially_paid', 'paid', 'completed');

  SELECT COALESCE(SUM(CASE WHEN status = 'partially_paid'
                           THEN COALESCE(advance_paid, 0)
                           ELSE COALESCE(total, 0) END), 0),
         COUNT(*)
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
           COALESCE(SUM(CASE WHEN status = 'partially_paid'
                             THEN COALESCE(advance_paid, 0)
                             ELSE COALESCE(total, 0) END), 0) AS revenue,
           COUNT(*)::bigint AS orders
    FROM public.orders
    WHERE store_id = _store_id
      AND created_at >= _range_start
      AND created_at <= _range_end
      AND status IN ('confirmed', 'shipped', 'delivered', 'partially_paid', 'paid', 'completed')
    GROUP BY 1 ORDER BY 1
  ) d;

  -- Top products: scale line revenue by the collected fraction on part-paid orders
  -- so product revenue sums back to the headline revenue figure.
  SELECT COALESCE(jsonb_agg(jsonb_build_object('name', p.name, 'units', p.units, 'revenue', p.revenue) ORDER BY p.revenue DESC), '[]'::jsonb)
    INTO _top_products
  FROM (
    SELECT COALESCE(NULLIF(oi.product_name, ''), 'Unknown product') AS name,
           COALESCE(SUM(COALESCE(oi.quantity, 1)), 0)::bigint AS units,
           COALESCE(SUM(
             COALESCE(oi.total, 0) *
             CASE WHEN o.status = 'partially_paid' AND COALESCE(o.total, 0) > 0
                  THEN COALESCE(o.advance_paid, 0) / o.total
                  ELSE 1 END
           ), 0) AS revenue
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

-- 2) Today card: same realized-revenue rule.
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

  SELECT COUNT(*)::int,
         COALESCE(SUM(CASE WHEN status = 'partially_paid'
                           THEN COALESCE(advance_paid, 0)
                           ELSE COALESCE(total, 0) END), 0)
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

-- 3) Traffic: exact de-duplicated visitors for recent ranges + non-overlapping prior period.
CREATE OR REPLACE FUNCTION public.get_analytics_traffic(_store_id uuid, _range_start timestamp with time zone, _range_end timestamp with time zone, _prior_start timestamp with time zone, _prior_end timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _tz text := 'Asia/Kolkata';
  _today date;
  _raw_cutoff timestamptz := now() - interval '95 days';
  _sessions bigint := 0; _visitors bigint := 0; _pageviews bigint := 0;
  _prior_sessions bigint := 0; _prior_visitors bigint := 0; _prior_pageviews bigint := 0;
BEGIN
  IF NOT (public.is_store_owner(_store_id) OR public.has_role(auth.uid(), 'admin'::public.app_role)) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT COALESCE(NULLIF(timezone, ''), 'Asia/Kolkata') INTO _tz FROM public.stores WHERE id = _store_id;
  _today := (now() AT TIME ZONE COALESCE(_tz, 'Asia/Kolkata'))::date;

  IF _range_start >= _raw_cutoff THEN
    -- Exact: distinct across the whole window (rollup sums double-count returning visitors).
    SELECT COUNT(DISTINCT COALESCE(NULLIF(session_id, ''), NULLIF(visitor_id, ''))),
           COUNT(DISTINCT COALESCE(NULLIF(visitor_id, ''), NULLIF(session_id, ''))),
           COUNT(*)
      INTO _sessions, _visitors, _pageviews
    FROM public.page_views
    WHERE store_id = _store_id AND created_at >= _range_start AND created_at <= _range_end
      AND COALESCE(is_bot, false) = false;
  ELSE
    WITH r AS (
      SELECT COALESCE(SUM(sessions),0)::bigint s, COALESCE(SUM(visitors),0)::bigint v, COALESCE(SUM(pageviews),0)::bigint p
      FROM public.page_views_daily
      WHERE store_id = _store_id
        AND date >= (_range_start AT TIME ZONE _tz)::date
        AND date <= LEAST((_range_end AT TIME ZONE _tz)::date, _today - 1)
    ), q AS (
      SELECT COUNT(DISTINCT COALESCE(NULLIF(session_id,''), NULLIF(visitor_id,'')))::bigint s,
             COUNT(DISTINCT COALESCE(NULLIF(visitor_id,''), NULLIF(session_id,'')))::bigint v,
             COUNT(*)::bigint p
      FROM public.page_views
      WHERE store_id = _store_id
        AND created_at >= GREATEST(_range_start, (_today::timestamp AT TIME ZONE _tz))
        AND created_at <= _range_end AND COALESCE(is_bot,false) = false
    )
    SELECT r.s + q.s, r.v + q.v, r.p + q.p INTO _sessions, _visitors, _pageviews FROM r, q;
  END IF;

  -- Prior window is half-open [start, end) so the current period's first day is never counted twice.
  IF _prior_end > _prior_start THEN
    IF _prior_start >= _raw_cutoff THEN
      SELECT COUNT(DISTINCT COALESCE(NULLIF(session_id, ''), NULLIF(visitor_id, ''))),
             COUNT(DISTINCT COALESCE(NULLIF(visitor_id, ''), NULLIF(session_id, ''))),
             COUNT(*)
        INTO _prior_sessions, _prior_visitors, _prior_pageviews
      FROM public.page_views
      WHERE store_id = _store_id AND created_at >= _prior_start AND created_at < _prior_end
        AND COALESCE(is_bot, false) = false;
    ELSE
      WITH r AS (
        SELECT COALESCE(SUM(sessions),0)::bigint s, COALESCE(SUM(visitors),0)::bigint v, COALESCE(SUM(pageviews),0)::bigint p
        FROM public.page_views_daily
        WHERE store_id = _store_id
          AND date >= (_prior_start AT TIME ZONE _tz)::date
          AND date < LEAST((_prior_end AT TIME ZONE _tz)::date, _today)
      ), q AS (
        SELECT COUNT(DISTINCT COALESCE(NULLIF(session_id,''), NULLIF(visitor_id,'')))::bigint s,
               COUNT(DISTINCT COALESCE(NULLIF(visitor_id,''), NULLIF(session_id,'')))::bigint v,
               COUNT(*)::bigint p
        FROM public.page_views
        WHERE store_id = _store_id
          AND created_at >= GREATEST(_prior_start, (_today::timestamp AT TIME ZONE _tz))
          AND created_at < _prior_end AND COALESCE(is_bot,false) = false
      )
      SELECT r.s + q.s, r.v + q.v, r.p + q.p INTO _prior_sessions, _prior_visitors, _prior_pageviews FROM r, q;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'sessions', COALESCE(_sessions,0), 'visitors', COALESCE(_visitors,0), 'pageviews', COALESCE(_pageviews,0),
    'prior_sessions', COALESCE(_prior_sessions,0), 'prior_visitors', COALESCE(_prior_visitors,0),
    'prior_pageviews', COALESCE(_prior_pageviews,0));
END;
$function$;

-- 4) Breakdowns: session-based, first-touch source attribution.
CREATE OR REPLACE FUNCTION public.get_analytics_breakdowns(_store_id uuid, _range_start timestamp with time zone, _range_end timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _top_pages jsonb := '[]'::jsonb;
  _sources jsonb := '[]'::jsonb;
  _countries jsonb := '[]'::jsonb;
  _devices jsonb := '[]'::jsonb;
BEGIN
  IF NOT (public.is_store_owner(_store_id) OR public.has_role(auth.uid(), 'admin'::public.app_role)) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('path', p.path, 'views', p.views) ORDER BY p.views DESC), '[]'::jsonb)
    INTO _top_pages
  FROM (
    SELECT COALESCE(NULLIF(path, ''), '/') AS path, COUNT(*)::bigint AS views
    FROM public.page_views
    WHERE store_id = _store_id AND created_at >= _range_start AND created_at <= _range_end
      AND COALESCE(is_bot, false) = false
    GROUP BY 1 ORDER BY 2 DESC LIMIT 10
  ) p;

  -- One row per session, using that session's FIRST pageview (true acquisition source).
  WITH first_touch AS (
    SELECT DISTINCT ON (COALESCE(NULLIF(session_id, ''), NULLIF(visitor_id, ''), id::text))
           COALESCE(NULLIF(session_id, ''), NULLIF(visitor_id, ''), id::text) AS sess,
           utm_source, referrer, country, device
    FROM public.page_views
    WHERE store_id = _store_id AND created_at >= _range_start AND created_at <= _range_end
      AND COALESCE(is_bot, false) = false
    ORDER BY 1, created_at ASC
  )
  SELECT
    (SELECT COALESCE(jsonb_agg(jsonb_build_object('name', s.name, 'value', s.value) ORDER BY s.value DESC), '[]'::jsonb)
       FROM (
         SELECT CASE
           WHEN NULLIF(utm_source, '') IS NOT NULL THEN lower(left(utm_source, 80))
           WHEN referrer IS NULL OR referrer = '' THEN 'direct'
           WHEN lower(referrer) LIKE '%google.%' THEN 'google'
           WHEN lower(referrer) LIKE '%facebook.%' OR lower(referrer) LIKE '%fb.%' THEN 'facebook'
           WHEN lower(referrer) LIKE '%instagram.%' THEN 'instagram'
           WHEN lower(referrer) LIKE '%youtube.%' THEN 'youtube'
           WHEN lower(referrer) LIKE '%whatsapp.%' OR lower(referrer) LIKE '%wa.me%' THEN 'whatsapp'
           WHEN lower(referrer) LIKE '%bing.%' THEN 'bing'
           WHEN lower(referrer) LIKE '%t.co%' OR lower(referrer) LIKE '%twitter.%' OR lower(referrer) LIKE '%x.com%' THEN 'twitter'
           ELSE 'referral' END AS name,
           COUNT(*)::bigint AS value
         FROM first_touch GROUP BY 1 ORDER BY 2 DESC LIMIT 8
       ) s),
    (SELECT COALESCE(jsonb_agg(jsonb_build_object('name', c.name, 'value', c.value) ORDER BY c.value DESC), '[]'::jsonb)
       FROM (
         SELECT upper(COALESCE(NULLIF(country, ''), 'Unknown')) AS name, COUNT(*)::bigint AS value
         FROM first_touch GROUP BY 1 ORDER BY 2 DESC LIMIT 10
       ) c),
    (SELECT COALESCE(jsonb_agg(jsonb_build_object('name', d.name, 'value', d.value) ORDER BY d.value DESC), '[]'::jsonb)
       FROM (
         SELECT lower(COALESCE(NULLIF(device, ''), 'unknown')) AS name, COUNT(*)::bigint AS value
         FROM first_touch GROUP BY 1 ORDER BY 2 DESC
       ) d)
  INTO _sources, _countries, _devices;

  RETURN jsonb_build_object('top_pages', COALESCE(_top_pages, '[]'::jsonb), 'sources', COALESCE(_sources, '[]'::jsonb),
                            'countries', COALESCE(_countries, '[]'::jsonb), 'devices', COALESCE(_devices, '[]'::jsonb));
END;
$function$;

-- 5) Exact server-side order breakdown (replaces a client query capped at 1000 rows).
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
           CASE WHEN status = 'partially_paid' THEN COALESCE(advance_paid, 0) ELSE COALESCE(total, 0) END AS rev,
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

-- 6) Funnel + drop-off diagnostics over the whole selected range (was today-only, client-side).
CREATE OR REPLACE FUNCTION public.get_analytics_funnel(_store_id uuid, _range_start timestamp with time zone, _range_end timestamp with time zone)
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

  WITH e AS (
    SELECT event_name, NULLIF(session_id, '') AS sid, product_id, metadata
    FROM public.storefront_events
    WHERE store_id = _store_id AND created_at >= _range_start AND created_at <= _range_end
  ),
  steps AS (
    SELECT event_name, COUNT(DISTINCT sid)::bigint AS sessions
    FROM e WHERE event_name IN ('view_product','add_to_cart','begin_checkout','pay_click','purchase')
    GROUP BY 1
  )
  SELECT jsonb_build_object(
    'steps', (SELECT COALESCE(jsonb_object_agg(event_name, sessions), '{}'::jsonb) FROM steps),
    'field_stops', (SELECT COALESCE(jsonb_agg(jsonb_build_object('key', k, 'n', n) ORDER BY n DESC), '[]'::jsonb)
      FROM (SELECT COALESCE(NULLIF(metadata->>'field',''),'unknown') k, COUNT(*)::bigint n
            FROM e WHERE event_name='checkout_field_error' GROUP BY 1 ORDER BY 2 DESC LIMIT 5) a),
    'pay_fail_reasons', (SELECT COALESCE(jsonb_agg(jsonb_build_object('key', k, 'n', n) ORDER BY n DESC), '[]'::jsonb)
      FROM (SELECT COALESCE(NULLIF(metadata->>'reason',''), NULLIF(metadata->>'payu_status',''),'unknown') k, COUNT(*)::bigint n
            FROM e WHERE event_name='payment_failed' GROUP BY 1 ORDER BY 2 DESC LIMIT 5) b),
    'zero_result_searches', (SELECT COALESCE(jsonb_agg(jsonb_build_object('key', k, 'n', n) ORDER BY n DESC), '[]'::jsonb)
      FROM (SELECT left(trim(metadata->>'query'), 40) k, COUNT(*)::bigint n
            FROM e WHERE event_name='search_no_results' AND NULLIF(trim(metadata->>'query'),'') IS NOT NULL
            GROUP BY 1 ORDER BY 2 DESC LIMIT 5) c),
    'cart_removes', (SELECT COALESCE(jsonb_agg(jsonb_build_object('key', k, 'n', n) ORDER BY n DESC), '[]'::jsonb)
      FROM (SELECT COALESCE(p.name, left(COALESCE(e.product_id::text,'unknown'), 40)) k, COUNT(*)::bigint n
            FROM e LEFT JOIN public.products p ON p.id = e.product_id
            WHERE e.event_name='cart_remove' GROUP BY 1 ORDER BY 2 DESC LIMIT 5) d),
    'variant_select_sessions', (SELECT COUNT(DISTINCT sid) FROM e WHERE event_name='pdp_variant_select'),
    'pdp_deep_scroll_sessions', (SELECT COUNT(DISTINCT sid) FROM e WHERE event_name='pdp_deep_scroll'),
    'attributed_pct', (SELECT CASE WHEN COUNT(DISTINCT sid) = 0 THEN 0
      ELSE ROUND(100.0 * COUNT(DISTINCT sid) FILTER (
        WHERE metadata ? 'fbclid' OR metadata ? 'gclid' OR metadata ? 'ttclid'
           OR metadata ? 'msclkid' OR metadata ? 'utm_source') / COUNT(DISTINCT sid), 1) END FROM e)
  ) INTO _res;

  RETURN COALESCE(_res, '{}'::jsonb);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_analytics_orders_breakdown(uuid, timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_analytics_funnel(uuid, timestamptz, timestamptz) TO authenticated;