CREATE TABLE IF NOT EXISTS public.meta_capi_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid,
  pixel_id text,
  event_name text,
  source text,
  http_status int,
  meta_code int,
  meta_subcode int,
  meta_message text,
  fbtrace_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS meta_capi_errors_store_created_idx ON public.meta_capi_errors (store_id, created_at DESC);

GRANT SELECT ON public.meta_capi_errors TO authenticated;
GRANT ALL ON public.meta_capi_errors TO service_role;
ALTER TABLE public.meta_capi_errors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners view their store CAPI errors" ON public.meta_capi_errors;
CREATE POLICY "Owners view their store CAPI errors"
ON public.meta_capi_errors FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = meta_capi_errors.store_id AND s.owner_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.meta_pixel_breaker (
  pixel_id text PRIMARY KEY,
  fails int NOT NULL DEFAULT 0,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  open_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.meta_pixel_breaker TO service_role;
ALTER TABLE public.meta_pixel_breaker ENABLE ROW LEVEL SECURITY;

DROP FUNCTION IF EXISTS public.capi_breaker_open(text);
CREATE FUNCTION public.capi_breaker_open(_pixel_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT open_until > now() FROM public.meta_pixel_breaker WHERE pixel_id = _pixel_id), false);
$$;

DROP FUNCTION IF EXISTS public.capi_breaker_record(text, boolean);
CREATE FUNCTION public.capi_breaker_record(_pixel_id text, _hard boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fails int;
  v_open boolean := false;
BEGIN
  IF NOT _hard THEN
    DELETE FROM public.meta_pixel_breaker WHERE pixel_id = _pixel_id;
    RETURN false;
  END IF;

  INSERT INTO public.meta_pixel_breaker (pixel_id, fails, window_started_at, updated_at)
  VALUES (_pixel_id, 1, now(), now())
  ON CONFLICT (pixel_id) DO UPDATE
    SET fails = CASE WHEN public.meta_pixel_breaker.window_started_at < now() - interval '10 minutes'
                     THEN 1 ELSE public.meta_pixel_breaker.fails + 1 END,
        window_started_at = CASE WHEN public.meta_pixel_breaker.window_started_at < now() - interval '10 minutes'
                     THEN now() ELSE public.meta_pixel_breaker.window_started_at END,
        updated_at = now()
  RETURNING fails INTO v_fails;

  IF v_fails >= 8 THEN
    UPDATE public.meta_pixel_breaker
       SET open_until = now() + interval '10 minutes', fails = 0, window_started_at = now()
     WHERE pixel_id = _pixel_id;
    v_open := true;
  END IF;

  RETURN v_open;
END;
$$;

REVOKE ALL ON FUNCTION public.capi_breaker_open(text) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.capi_breaker_record(text, boolean) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.capi_breaker_open(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.capi_breaker_record(text, boolean) TO service_role;