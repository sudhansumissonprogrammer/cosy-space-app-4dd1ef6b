
-- Fix security definer views by recreating with security_invoker = true
DROP VIEW IF EXISTS public.platform_config_public;
DROP VIEW IF EXISTS public.store_payment_config_public;

CREATE VIEW public.platform_config_public 
WITH (security_invoker = true) AS
SELECT id, platform_name, default_currency, created_at, updated_at
FROM public.platform_config;

CREATE VIEW public.store_payment_config_public
WITH (security_invoker = true) AS
SELECT id, store_id, payment_methods, razorpay_key_id, created_at, updated_at
FROM public.store_payment_config;

GRANT SELECT ON public.platform_config_public TO anon, authenticated;
GRANT SELECT ON public.store_payment_config_public TO anon, authenticated;

-- Add a read policy for platform_config for authenticated users (non-sensitive fields accessed via view)
-- Admins already have ALL access; we need authenticated to SELECT through the view
CREATE POLICY "Authenticated can view platform config"
ON public.platform_config
FOR SELECT
TO authenticated
USING (true);

-- Anon needs to read platform_config through the view too (for storefront)
CREATE POLICY "Anon can view platform config"
ON public.platform_config
FOR SELECT
TO anon
USING (true);
