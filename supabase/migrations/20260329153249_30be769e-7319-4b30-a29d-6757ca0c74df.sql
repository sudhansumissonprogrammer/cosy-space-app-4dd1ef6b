
-- Fix 1: Remove public SELECT on platform_config that exposes WA credentials
-- Replace with a policy that only allows anon to see non-sensitive columns via a view

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Anyone can view platform config" ON public.platform_config;

-- Create a safe public view with only non-sensitive columns
CREATE OR REPLACE VIEW public.platform_config_public AS
SELECT id, platform_name, default_currency, created_at, updated_at
FROM public.platform_config;

-- Grant anon/authenticated access to the view
GRANT SELECT ON public.platform_config_public TO anon, authenticated;

-- Fix 2: Restrict store_payment_config SELECT to not expose razorpay_key_secret
-- Create a safe view for reading payment config (without secrets)
CREATE OR REPLACE VIEW public.store_payment_config_public AS
SELECT id, store_id, payment_methods, razorpay_key_id, created_at, updated_at
FROM public.store_payment_config;

GRANT SELECT ON public.store_payment_config_public TO anon, authenticated;
