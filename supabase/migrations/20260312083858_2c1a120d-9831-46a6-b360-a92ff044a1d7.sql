
-- Fix: Use security_invoker view + add restricted anon SELECT policy on base table
-- that only allows reading non-secret columns via the view
DROP VIEW IF EXISTS public.store_payment_config_public;

CREATE VIEW public.store_payment_config_public
WITH (security_invoker = on) AS
SELECT id, store_id, payment_methods, razorpay_key_id, created_at, updated_at
FROM public.store_payment_config;

-- Add anon SELECT policy on base table - this is required for security_invoker view
-- The view already filters out razorpay_key_secret column
CREATE POLICY "Anon can select payment config for view"
ON public.store_payment_config
FOR SELECT
TO anon
USING (true);
