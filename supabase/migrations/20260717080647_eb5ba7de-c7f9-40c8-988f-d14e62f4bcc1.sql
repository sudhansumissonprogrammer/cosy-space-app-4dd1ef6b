
-- B1: Unique partial index on stores.facebook_pixel_id
CREATE UNIQUE INDEX IF NOT EXISTS stores_pixel_id_unique
  ON public.stores (facebook_pixel_id)
  WHERE facebook_pixel_id IS NOT NULL AND facebook_pixel_id <> '';

-- B4: Persistent cross-isolate rate-limit table
CREATE TABLE IF NOT EXISTS public.edge_rate_limits (
  key TEXT PRIMARY KEY,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.edge_rate_limits TO service_role;

ALTER TABLE public.edge_rate_limits ENABLE ROW LEVEL SECURITY;

-- No policies for anon/authenticated: table is exclusively accessed
-- by edge functions via service_role. Locked-down by default.

CREATE INDEX IF NOT EXISTS edge_rate_limits_window_start_idx
  ON public.edge_rate_limits (window_start);

-- Atomic rate-limit RPC: increments counter and returns TRUE when the
-- caller is over the limit within the rolling window.
CREATE OR REPLACE FUNCTION public.hit_rate_limit(
  _key TEXT,
  _max INTEGER,
  _window_seconds INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _now TIMESTAMPTZ := now();
  _cutoff TIMESTAMPTZ := _now - make_interval(secs => _window_seconds);
  _new_count INTEGER;
BEGIN
  INSERT INTO public.edge_rate_limits AS r (key, window_start, count, updated_at)
  VALUES (_key, _now, 1, _now)
  ON CONFLICT (key) DO UPDATE
  SET count = CASE
                WHEN r.window_start < _cutoff THEN 1
                ELSE r.count + 1
              END,
      window_start = CASE
                       WHEN r.window_start < _cutoff THEN _now
                       ELSE r.window_start
                     END,
      updated_at = _now
  RETURNING count INTO _new_count;

  RETURN _new_count > _max;
END;
$$;

REVOKE ALL ON FUNCTION public.hit_rate_limit(TEXT, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hit_rate_limit(TEXT, INTEGER, INTEGER) TO service_role;
