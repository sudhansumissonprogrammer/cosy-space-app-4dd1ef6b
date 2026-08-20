CREATE OR REPLACE FUNCTION public.get_live_visitors(_store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _cut timestamptz := now() - interval '90 seconds';
  _active int := 0;
  _mobile int := 0;
  _desktop int := 0;
  _tablet int := 0;
  _pages jsonb := '[]'::jsonb;
BEGIN
  IF NOT (public.is_store_owner(_store_id) OR public.has_role(auth.uid(), 'admin'::public.app_role)) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT count(*)::int,
         count(*) FILTER (WHERE lower(COALESCE(device,'desktop')) = 'mobile')::int,
         count(*) FILTER (WHERE lower(COALESCE(device,'desktop')) = 'desktop')::int,
         count(*) FILTER (WHERE lower(COALESCE(device,'desktop')) = 'tablet')::int
    INTO _active, _mobile, _desktop, _tablet
  FROM public.live_sessions
  WHERE store_id = _store_id AND last_seen >= _cut;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('path', path, 'count', c) ORDER BY c DESC), '[]'::jsonb)
    INTO _pages
  FROM (
    SELECT COALESCE(path, '/') AS path, count(*)::int AS c
    FROM public.live_sessions
    WHERE store_id = _store_id AND last_seen >= _cut
    GROUP BY 1
    ORDER BY 2 DESC
    LIMIT 3
  ) t;

  RETURN jsonb_build_object('active', _active, 'mobile', _mobile, 'desktop', _desktop, 'tablet', _tablet, 'top_pages', _pages);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_live_visitors(uuid) TO authenticated;