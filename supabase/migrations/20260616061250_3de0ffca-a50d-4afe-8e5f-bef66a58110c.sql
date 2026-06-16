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
  _tz text := 'Asia/Kolkata';
  _today date;
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

  SELECT COALESCE(NULLIF(timezone, ''), 'Asia/Kolkata')
    INTO _tz
  FROM public.stores
  WHERE id = _store_id;

  _today := (now() AT TIME ZONE COALESCE(_tz, 'Asia/Kolkata'))::date;

  WITH current_rollup AS (
    SELECT
      COALESCE(SUM(sessions), 0)::int AS sessions,
      COALESCE(SUM(visitors), 0)::int AS visitors,
      COALESCE(SUM(pageviews), 0)::int AS pageviews
    FROM public.page_views_daily
    WHERE store_id = _store_id
      AND date >= (_range_start AT TIME ZONE _tz)::date
      AND date <= LEAST((_range_end AT TIME ZONE _tz)::date, _today - 1)
  ),
  current_raw AS (
    SELECT
      COUNT(DISTINCT COALESCE(NULLIF(session_id, ''), NULLIF(visitor_id, '')))::int AS sessions,
      COUNT(DISTINCT COALESCE(NULLIF(visitor_id, ''), NULLIF(session_id, '')))::int AS visitors,
      COUNT(*)::int AS pageviews
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
      COALESCE(SUM(sessions), 0)::int AS sessions,
      COALESCE(SUM(visitors), 0)::int AS visitors,
      COALESCE(SUM(pageviews), 0)::int AS pageviews
    FROM public.page_views_daily
    WHERE store_id = _store_id
      AND date >= (_prior_start AT TIME ZONE _tz)::date
      AND date <= LEAST((_prior_end AT TIME ZONE _tz)::date, _today - 1)
  ),
  prior_raw AS (
    SELECT
      COUNT(DISTINCT COALESCE(NULLIF(session_id, ''), NULLIF(visitor_id, '')))::int AS sessions,
      COUNT(DISTINCT COALESCE(NULLIF(visitor_id, ''), NULLIF(session_id, '')))::int AS visitors,
      COUNT(*)::int AS pageviews
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
$$;

GRANT EXECUTE ON FUNCTION public.get_analytics_traffic(uuid, timestamptz, timestamptz, timestamptz, timestamptz) TO authenticated;