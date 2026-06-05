DROP FUNCTION IF EXISTS public.get_today_analytics(uuid);

CREATE OR REPLACE FUNCTION public.get_today_analytics(_store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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

  SELECT COALESCE(NULLIF(timezone, ''), 'Asia/Kolkata')
    INTO _tz
  FROM public.stores
  WHERE id = _store_id;

  _start := (date_trunc('day', now() AT TIME ZONE COALESCE(_tz, 'Asia/Kolkata')) AT TIME ZONE COALESCE(_tz, 'Asia/Kolkata'));

  SELECT
    COUNT(*)::int,
    COALESCE(SUM(total), 0)
  INTO _orders, _revenue
  FROM public.orders
  WHERE store_id = _store_id
    AND created_at >= _start
    AND status IN ('confirmed', 'shipped', 'delivered', 'partially_paid');

  SELECT
    COUNT(*)::int,
    COUNT(DISTINCT COALESCE(NULLIF(session_id, ''), NULLIF(visitor_id, '')))::int,
    COUNT(DISTINCT COALESCE(NULLIF(visitor_id, ''), NULLIF(session_id, '')))::int
  INTO _pageviews, _sessions, _visitors
  FROM public.page_views
  WHERE store_id = _store_id
    AND created_at >= _start
    AND COALESCE(is_bot, false) = false;

  RETURN jsonb_build_object(
    'orders', _orders,
    'revenue', _revenue,
    'sessions', _sessions,
    'visitors', _visitors,
    'pageviews', _pageviews,
    'today_start', _start
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_today_analytics(uuid) TO authenticated;

DROP FUNCTION IF EXISTS public.get_analytics_traffic(uuid, timestamptz, timestamptz, timestamptz, timestamptz);

CREATE OR REPLACE FUNCTION public.get_analytics_traffic(
  _store_id uuid,
  _range_start timestamptz,
  _range_end timestamptz,
  _prior_start timestamptz,
  _prior_end timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _sessions int := 0;
  _visitors int := 0;
  _pageviews int := 0;
  _prior_sessions int := 0;
  _prior_visitors int := 0;
  _prior_pageviews int := 0;
BEGIN
  IF NOT (public.is_store_owner(_store_id) OR public.has_role(auth.uid(), 'admin'::public.app_role)) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT
    COUNT(DISTINCT COALESCE(NULLIF(session_id, ''), NULLIF(visitor_id, '')))::int,
    COUNT(DISTINCT COALESCE(NULLIF(visitor_id, ''), NULLIF(session_id, '')))::int,
    COUNT(*)::int
  INTO _sessions, _visitors, _pageviews
  FROM public.page_views
  WHERE store_id = _store_id
    AND created_at >= _range_start
    AND created_at <= _range_end
    AND COALESCE(is_bot, false) = false;

  SELECT
    COUNT(DISTINCT COALESCE(NULLIF(session_id, ''), NULLIF(visitor_id, '')))::int,
    COUNT(DISTINCT COALESCE(NULLIF(visitor_id, ''), NULLIF(session_id, '')))::int,
    COUNT(*)::int
  INTO _prior_sessions, _prior_visitors, _prior_pageviews
  FROM public.page_views
  WHERE store_id = _store_id
    AND created_at >= _prior_start
    AND created_at <= _prior_end
    AND COALESCE(is_bot, false) = false;

  RETURN jsonb_build_object(
    'sessions', _sessions,
    'visitors', _visitors,
    'pageviews', _pageviews,
    'prior_sessions', _prior_sessions,
    'prior_visitors', _prior_visitors,
    'prior_pageviews', _prior_pageviews
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_analytics_traffic(uuid, timestamptz, timestamptz, timestamptz, timestamptz) TO authenticated;