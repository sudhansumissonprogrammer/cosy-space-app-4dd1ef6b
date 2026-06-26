
REVOKE SELECT (access_token) ON public.whatsapp_config FROM authenticated;
REVOKE SELECT (access_token) ON public.whatsapp_config FROM anon;

CREATE OR REPLACE FUNCTION public.get_own_whatsapp_token(_store_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT wc.access_token
  FROM public.whatsapp_config wc
  WHERE wc.store_id = _store_id
    AND EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.id = _store_id AND s.owner_id = auth.uid()
    )
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_own_whatsapp_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_own_whatsapp_token(uuid) TO authenticated;
