CREATE OR REPLACE FUNCTION public.get_analytics_quality(_store_id uuid, _range_start timestamp with time zone, _range_end timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _tz text := 'Asia/Kolkata';
  _today date;
  _raw_cutoff timestamptz := now() - interval '95 days';
  _sessions bigint := 0; _pageviews bigint := 0; _bounces bigint := 0; _dur numeric := 0;
BEGIN
  IF NOT (public.is_store_owner(_store_id) OR public.has_role(auth.uid(), 'admin'::public.app_role)) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT COALESCE(NULLIF(timezone, ''), 'Asia/Kolkata') INTO _tz FROM public.stores WHERE id = _store_id;
  _today := (now() AT TIME ZONE COALESCE(_tz, 'Asia/Kolkata'))::date;

  IF _range_start >= _raw_cutoff THEN
    SELECT COUNT(*)::bigint,
           COALESCE(SUM(hits), 0)::bigint,
           COUNT(*) FILTER (WHERE hits = 1)::bigint,
           COALESCE(SUM(EXTRACT(EPOCH FROM (last_seen - first_seen))), 0)
      INTO _sessions, _pageviews, _bounces, _dur
    FROM (
      SELECT COALESCE(NULLIF(session_id, ''), NULLIF(visitor_id, ''), id::text) AS sess,
             COUNT(*)::bigint AS hits, MIN(created_at) AS first_seen, MAX(created_at) AS last_seen
      FROM public.page_views
      WHERE store_id = _store_id AND created_at >= _range_start AND created_at <= _range_end
        AND COALESCE(is_bot, false) = false
      GROUP BY 1
    ) s;
  ELSE
    WITH r AS (
      SELECT COALESCE(SUM(sessions),0)::bigint s, COALESCE(SUM(pageviews),0)::bigint p,
             COALESCE(SUM(bounce_sessions),0)::bigint b, COALESCE(SUM(total_session_duration_seconds),0)::numeric d
      FROM public.page_views_daily
      WHERE store_id = _store_id
        AND date >= (_range_start AT TIME ZONE _tz)::date
        AND date <= LEAST((_range_end AT TIME ZONE _tz)::date, _today - 1)
    ), q AS (
      SELECT COUNT(*)::bigint s, COALESCE(SUM(hits),0)::bigint p,
             COUNT(*) FILTER (WHERE hits = 1)::bigint b,
             COALESCE(SUM(EXTRACT(EPOCH FROM (last_seen - first_seen))),0)::numeric d
      FROM (
        SELECT COALESCE(NULLIF(session_id,''), NULLIF(visitor_id,''), id::text) sess,
               COUNT(*)::bigint hits, MIN(created_at) first_seen, MAX(created_at) last_seen
        FROM public.page_views
        WHERE store_id = _store_id
          AND created_at >= GREATEST(_range_start, (_today::timestamp AT TIME ZONE _tz))
          AND created_at <= _range_end AND COALESCE(is_bot,false) = false
        GROUP BY 1
      ) t
    )
    SELECT r.s + q.s, r.p + q.p, r.b + q.b, r.d + q.d INTO _sessions, _pageviews, _bounces, _dur FROM r, q;
  END IF;

  RETURN jsonb_build_object(
    'sessions', COALESCE(_sessions, 0),
    'pageviews', COALESCE(_pageviews, 0),
    'bounce_sessions', COALESCE(_bounces, 0),
    'avg_duration_sec', CASE WHEN COALESCE(_sessions,0) > 0 THEN ROUND(COALESCE(_dur,0) / _sessions, 1) ELSE 0 END
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_analytics_quality(uuid, timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_analytics_quality(uuid, timestamptz, timestamptz) TO authenticated, service_role;