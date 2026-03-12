
-- Remove the anon SELECT on base table (exposes secret column)
DROP POLICY IF EXISTS "Anon can select payment config for view" ON public.store_payment_config;

-- Instead, use a SECURITY DEFINER function to return public payment config
CREATE OR REPLACE FUNCTION public.get_store_payment_config(_store_id uuid)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT json_build_object(
    'id', id,
    'store_id', store_id,
    'payment_methods', payment_methods,
    'razorpay_key_id', razorpay_key_id,
    'created_at', created_at,
    'updated_at', updated_at
  )
  FROM store_payment_config
  WHERE store_id = _store_id
  LIMIT 1;
$$;

-- Keep the view for backward compat but make it security_invoker with no anon access
-- Anon users should use the function instead
DROP VIEW IF EXISTS public.store_payment_config_public;
CREATE VIEW public.store_payment_config_public
WITH (security_invoker = on) AS
SELECT id, store_id, payment_methods, razorpay_key_id, created_at, updated_at
FROM public.store_payment_config;
