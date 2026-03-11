
-- Fix: Replace security_invoker view with security_definer view
-- so storefront customers can read payment methods (without secrets)
DROP VIEW IF EXISTS public.store_payment_config_public;

CREATE OR REPLACE VIEW public.store_payment_config_public
WITH (security_invoker = off) AS
SELECT id, store_id, payment_methods, razorpay_key_id, created_at, updated_at
FROM public.store_payment_config;

-- Grant SELECT on the view to anon and authenticated
GRANT SELECT ON public.store_payment_config_public TO anon, authenticated;
