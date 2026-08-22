CREATE OR REPLACE FUNCTION public.get_store_disabled_apps(_store_slug text)
RETURNS TABLE(app_id text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sa.app_id
  FROM public.store_apps sa
  JOIN public.stores s ON s.id = sa.store_id
  WHERE s.slug = _store_slug AND sa.enabled = false;
$$;

REVOKE ALL ON FUNCTION public.get_store_disabled_apps(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_store_disabled_apps(text) TO anon, authenticated, service_role;