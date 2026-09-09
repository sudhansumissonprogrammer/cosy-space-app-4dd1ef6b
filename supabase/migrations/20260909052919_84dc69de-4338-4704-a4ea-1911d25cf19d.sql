ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS checkout_otp_enabled boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.get_store_checkout_otp(_store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(s.checkout_otp_enabled, false)
  FROM public.stores s
  WHERE s.id = _store_id AND s.is_suspended = false
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_store_checkout_otp(uuid) TO anon, authenticated, service_role;