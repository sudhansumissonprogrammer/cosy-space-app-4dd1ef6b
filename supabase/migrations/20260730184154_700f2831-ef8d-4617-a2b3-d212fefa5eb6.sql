CREATE TABLE IF NOT EXISTS public.live_sessions (
  store_id uuid NOT NULL,
  session_id text NOT NULL,
  visitor_id text,
  path text,
  device text,
  first_seen timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (store_id, session_id)
);

CREATE INDEX IF NOT EXISTS live_sessions_store_last_seen_idx ON public.live_sessions (store_id, last_seen DESC);

GRANT ALL ON public.live_sessions TO service_role;
ALTER TABLE public.live_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Store owners can view their live sessions" ON public.live_sessions;
CREATE POLICY "Store owners can view their live sessions"
  ON public.live_sessions FOR SELECT TO authenticated
  USING (public.is_store_owner(store_id) OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE OR REPLACE FUNCTION public.touch_live_session(
  _store_id uuid,
  _session_id text,
  _visitor_id text DEFAULT NULL,
  _path text DEFAULT NULL,
  _device text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF _store_id IS NULL OR _session_id IS NULL OR length(_session_id) < 8 THEN
    RETURN;
  END IF;

  INSERT INTO public.live_sessions (store_id, session_id, visitor_id, path, device, first_seen, last_seen)
  VALUES (_store_id, left(_session_id, 100), left(_visitor_id, 100), left(_path, 200), left(_device, 20), now(), now())
  ON CONFLICT (store_id, session_id) DO UPDATE
    SET last_seen = now(),
        path = COALESCE(EXCLUDED.path, public.live_sessions.path),
        device = COALESCE(EXCLUDED.device, public.live_sessions.device),
        visitor_id = COALESCE(EXCLUDED.visitor_id, public.live_sessions.visitor_id);

  -- opportunistic cleanup (~2% of calls)
  IF random() < 0.02 THEN
    DELETE FROM public.live_sessions WHERE last_seen < now() - interval '30 minutes';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.touch_live_session(uuid, text, text, text, text) TO anon, authenticated;

DROP FUNCTION IF EXISTS public.get_live_visitors(uuid);
CREATE OR REPLACE FUNCTION public.get_live_visitors(_store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _cut timestamptz := now() - interval '60 seconds';
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