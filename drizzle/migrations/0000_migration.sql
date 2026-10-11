CREATE INDEX IF NOT EXISTS storefront_events_reel_idx ON public.storefront_events (store_id, created_at) WHERE event_name IN ('reel_bubble_view','reel_open','reel_watch');

CREATE OR REPLACE FUNCTION public.get_reel_analytics(_store_id uuid, _range_start timestamptz, _range_end timestamptz)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _res jsonb;
BEGIN
  IF NOT (public.is_store_owner(_store_id) OR public.has_role(auth.uid(), 'admin'::public.app_role)) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  WITH e AS (
    SELECT event_name, COALESCE(NULLIF(visitor_id,''), NULLIF(session_id,'')) AS vid, metadata
    FROM public.storefront_events
    WHERE store_id = _store_id AND created_at >= _range_start AND created_at <= _range_end
      AND event_name IN ('reel_bubble_view','reel_open','reel_watch')
  ), w AS (
    SELECT vid, metadata->>'reel_id' AS reel_id, NULLIF(metadata->>'reel_title','') AS title,
      COALESCE((metadata->>'reel_index')::int, 0) AS idx,
      LEAST(COALESCE((metadata->>'seconds')::numeric, 0), 600) AS secs,
      COALESCE((metadata->>'completed')::boolean, false) AS done
    FROM e WHERE event_name = 'reel_watch'
  ), per_vis AS (
    SELECT vid, COUNT(DISTINCT reel_id) AS reels, SUM(secs) AS secs FROM w GROUP BY vid
  )
  SELECT jsonb_build_object(
    'bubble_viewers', (SELECT COUNT(DISTINCT vid) FROM e WHERE event_name='reel_bubble_view'),
    'openers', (SELECT COUNT(DISTINCT vid) FROM e WHERE event_name='reel_open'),
    'opens', (SELECT COUNT(*) FROM e WHERE event_name='reel_open'),
    'watchers', (SELECT COUNT(*) FROM per_vis),
    'multi_reel_viewers', (SELECT COUNT(*) FROM per_vis WHERE reels > 1),
    'full_watchers', (SELECT COUNT(DISTINCT vid) FROM w WHERE done),
    'avg_seconds_per_viewer', (SELECT COALESCE(ROUND(AVG(secs),1),0) FROM per_vis),
    'total_seconds', (SELECT COALESCE(ROUND(SUM(secs)),0) FROM w),
    'buckets', jsonb_build_object(
      'lt3', (SELECT COUNT(*) FROM w WHERE secs < 3),
      's3_10', (SELECT COUNT(*) FROM w WHERE secs >= 3 AND secs < 10),
      's10_30', (SELECT COUNT(*) FROM w WHERE secs >= 10 AND secs < 30),
      'gte30', (SELECT COUNT(*) FROM w WHERE secs >= 30)),
    'reels', (SELECT COALESCE(jsonb_agg(r ORDER BY (r->>'viewers')::int DESC), '[]'::jsonb) FROM (
      SELECT jsonb_build_object('reel_id', reel_id, 'title', MAX(title), 'position', MIN(idx),
        'viewers', COUNT(DISTINCT vid), 'avg_seconds', ROUND(AVG(secs),1),
        'full_views', COUNT(*) FILTER (WHERE done), 'views', COUNT(*)) r
      FROM w GROUP BY reel_id LIMIT 30) x)
  ) INTO _res;
  RETURN COALESCE(_res, '{}'::jsonb);
END; $$;
REVOKE ALL ON FUNCTION public.get_reel_analytics(uuid, timestamptz, timestamptz) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_reel_analytics(uuid, timestamptz, timestamptz) TO authenticated;