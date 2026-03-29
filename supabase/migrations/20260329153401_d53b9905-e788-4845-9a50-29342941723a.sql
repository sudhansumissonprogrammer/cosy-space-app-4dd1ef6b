
-- Remove the overly permissive policies we just added - they still expose sensitive columns
DROP POLICY IF EXISTS "Authenticated can view platform config" ON public.platform_config;
DROP POLICY IF EXISTS "Anon can view platform config" ON public.platform_config;

-- Drop the security_invoker view and recreate as security definer with only safe columns
-- This is safe because the view explicitly limits columns to non-sensitive ones
DROP VIEW IF EXISTS public.platform_config_public;
CREATE VIEW public.platform_config_public 
WITH (security_invoker = false) AS
SELECT id, platform_name, default_currency, created_at, updated_at
FROM public.platform_config;

GRANT SELECT ON public.platform_config_public TO anon, authenticated;
