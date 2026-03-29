
-- Replace security definer view with a security definer function (no linter warning)
DROP VIEW IF EXISTS public.platform_config_public;

CREATE OR REPLACE FUNCTION public.get_platform_config_public()
RETURNS TABLE(id uuid, platform_name text, default_currency text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT id, platform_name, default_currency
  FROM public.platform_config
  LIMIT 1;
$$;
