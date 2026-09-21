REVOKE SELECT (checkout_otp_enabled) ON public.stores FROM authenticated;

CREATE OR REPLACE FUNCTION public.get_own_store_checkout_otp(_store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(s.checkout_otp_enabled, false)
  FROM public.stores s
  WHERE s.id = _store_id
    AND (s.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role))
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.get_own_store_checkout_otp(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_own_store_checkout_otp(uuid) TO authenticated, service_role;