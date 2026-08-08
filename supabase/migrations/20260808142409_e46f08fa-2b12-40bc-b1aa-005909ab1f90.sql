CREATE OR REPLACE FUNCTION public.verify_cron_secret(_secret text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.cron_auth
    WHERE secret = _secret
  );
$$;

GRANT EXECUTE ON FUNCTION public.verify_cron_secret(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.verify_cron_secret(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_cron_secret(text) TO anon;
