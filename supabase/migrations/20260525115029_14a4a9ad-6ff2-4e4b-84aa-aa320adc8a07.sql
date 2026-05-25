CREATE OR REPLACE FUNCTION public.get_own_store_private_settings(_store_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT jsonb_build_object(
    'owner_email', s.owner_email,
    'default_profit_margin', s.default_profit_margin
  )
  FROM public.stores s
  WHERE s.id = _store_id
    AND (
      s.owner_id = auth.uid()
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
    )
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.get_own_store_private_settings(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_own_store_private_settings(uuid) TO authenticated;